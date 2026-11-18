/**
 * Database-level protections for financial records (PostgreSQL), installed idempotently by
 * scripts/bootstrap-production.ts on every deploy (after `prisma db push`, which ignores these
 * triggers and the partial index: `prisma migrate diff` against a guarded DB is empty).
 *
 *  - SettlementLedger: financial columns (sellerOrgId, sellerOrderId, entryType, amountMinor,
 *    referenceId, createdAt) can never be UPDATEd and rows can never be DELETEd. Workflow columns
 *    (status, holdReason, eligibleAt, settledAt, balanceAfterMinor, description, actorUserId,
 *    updatedAt) stay updatable: holds, escrow release and cancellations change status only.
 *  - AuditEvent: insert-only (no UPDATE, no DELETE).
 *  - Refund: amountMinor can never change and rows can never be deleted (status may change).
 *  - Unique (sellerOrgId, referenceId) for MANUAL_PAYOUT ledger rows: one bank reference pays once.
 *
 * Consequences (intended): deleting a SellerOrg/SellerOrder/User whose deletion would cascade to,
 * or SET NULL on, these rows now fails. Financial history is closed or anonymised, never deleted.
 *
 * Also here: one-time data hygiene that must run BEFORE the guards exist (encrypting legacy
 * plaintext IBANs, masking full IBANs inside legacy audit details). No values are ever logged.
 */
import type { PrismaClient } from "@prisma/client";
import { encryptField, isEncryptionConfigured, isEncryptedValue, last4 } from "@/lib/crypto";

type Log = (message: string) => void;

export interface GuardStatement {
  name: string;
  sql: string;
}

export const FINANCIAL_DB_GUARDS: GuardStatement[] = [
  {
    name: "function wizz_settlement_ledger_guard",
    sql: `
CREATE OR REPLACE FUNCTION wizz_settlement_ledger_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'SettlementLedger rows are immutable financial records and cannot be deleted (id %)', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."sellerOrgId" IS DISTINCT FROM OLD."sellerOrgId"
     OR NEW."sellerOrderId" IS DISTINCT FROM OLD."sellerOrderId"
     OR NEW."entryType" IS DISTINCT FROM OLD."entryType"
     OR NEW."amountMinor" IS DISTINCT FROM OLD."amountMinor"
     OR NEW."referenceId" IS DISTINCT FROM OLD."referenceId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'SettlementLedger financial columns are immutable (id %); post a compensating entry instead', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
  },
  { name: "drop trigger on SettlementLedger", sql: `DROP TRIGGER IF EXISTS wizz_settlement_ledger_guard ON "SettlementLedger"` },
  {
    name: "trigger on SettlementLedger",
    sql: `CREATE TRIGGER wizz_settlement_ledger_guard BEFORE UPDATE OR DELETE ON "SettlementLedger" FOR EACH ROW EXECUTE FUNCTION wizz_settlement_ledger_guard()`,
  },
  {
    name: "function wizz_audit_event_guard",
    sql: `
CREATE OR REPLACE FUNCTION wizz_audit_event_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent is insert-only: % is not allowed (id %)', TG_OP, OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql`,
  },
  { name: "drop trigger on AuditEvent", sql: `DROP TRIGGER IF EXISTS wizz_audit_event_guard ON "AuditEvent"` },
  {
    name: "trigger on AuditEvent",
    sql: `CREATE TRIGGER wizz_audit_event_guard BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION wizz_audit_event_guard()`,
  },
  {
    name: "function wizz_refund_guard",
    sql: `
CREATE OR REPLACE FUNCTION wizz_refund_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Refund rows cannot be deleted (id %)', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."amountMinor" IS DISTINCT FROM OLD."amountMinor" THEN
    RAISE EXCEPTION 'Refund amount is immutable (id %)', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
  },
  { name: "drop trigger on Refund", sql: `DROP TRIGGER IF EXISTS wizz_refund_guard ON "Refund"` },
  {
    name: "trigger on Refund",
    sql: `CREATE TRIGGER wizz_refund_guard BEFORE UPDATE OR DELETE ON "Refund" FOR EACH ROW EXECUTE FUNCTION wizz_refund_guard()`,
  },
  {
    name: "unique MANUAL_PAYOUT reference per seller",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "SettlementLedger_manual_payout_reference_key" ON "SettlementLedger" ("sellerOrgId", "referenceId") WHERE "entryType" = 'MANUAL_PAYOUT'`,
  },
];

/**
 * Applies every guard statement. Each runs on its own so one failure (logged) does not stop the
 * others or the bootstrap. Returns the number of statements that failed.
 */
export async function installFinancialDbGuards(db: PrismaClient, log: Log = console.log): Promise<number> {
  let failures = 0;
  for (const statement of FINANCIAL_DB_GUARDS) {
    try {
      await db.$executeRawUnsafe(statement.sql);
    } catch (err) {
      failures++;
      log(`[db-guards] FAILED: ${statement.name}: ${err instanceof Error ? err.message.split("\n").slice(-1)[0] : String(err)}`);
    }
  }
  log(`[db-guards] Financial DB guards: ${FINANCIAL_DB_GUARDS.length - failures}/${FINANCIAL_DB_GUARDS.length} statements applied`);
  return failures;
}

/** Encrypts legacy plaintext IBANs on SellerOrg and SellerApplication. Idempotent; logs counts only. */
export async function encryptLegacyBankDetails(db: PrismaClient, log: Log = console.log): Promise<{ orgs: number; applications: number }> {
  if (!isEncryptionConfigured()) {
    log("[bank-encryption] DATA_ENCRYPTION_KEY is not set; legacy bank details were left unchanged (set it and redeploy).");
    return { orgs: 0, applications: 0 };
  }
  let orgs = 0;
  let applications = 0;

  const orgRows = await db.sellerOrg.findMany({ where: { bankIban: { not: null } }, select: { id: true, bankIban: true } });
  for (const row of orgRows) {
    if (!row.bankIban || isEncryptedValue(row.bankIban)) continue;
    const plain = row.bankIban.replace(/\s+/g, "").toUpperCase();
    // Conditional on the value read, so a concurrent edit is never overwritten
    const res = await db.sellerOrg.updateMany({ where: { id: row.id, bankIban: row.bankIban }, data: { bankIban: encryptField(plain) } });
    orgs += res.count;
  }

  const appRows = await db.sellerApplication.findMany({ where: { bankIban: { not: null } }, select: { id: true, bankIban: true } });
  for (const row of appRows) {
    if (!row.bankIban || isEncryptedValue(row.bankIban)) continue;
    const plain = row.bankIban.replace(/\s+/g, "").toUpperCase();
    const res = await db.sellerApplication.updateMany({ where: { id: row.id, bankIban: row.bankIban }, data: { bankIban: encryptField(plain) } });
    applications += res.count;
  }

  log(`[bank-encryption] Encrypted ${orgs} store and ${applications} application bank account number(s) stored in plaintext`);
  return { orgs, applications };
}

const IBAN_KEY = /iban/i;

function maskIbanValues(value: unknown): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const r = maskIbanValues(v);
      changed ||= r.changed;
      return r.value;
    });
    return { value: out, changed };
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (IBAN_KEY.test(k) && !/last4/i.test(k) && typeof v === "string" && v && !v.startsWith("•")) {
        out[k] = `•••• ${last4(isEncryptedValue(v) ? "" : v) ?? ""}`.trim();
        changed = true;
      } else {
        const r = maskIbanValues(v);
        out[k] = r.value;
        changed ||= r.changed;
      }
    }
    return { value: out, changed };
  }
  return { value, changed: false };
}

async function auditGuardInstalled(db: PrismaClient): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'wizz_audit_event_guard' AND NOT tgisinternal`
  );
  return (rows[0]?.n ?? 0) > 0;
}

/**
 * Masks full IBANs that older code wrote into AuditEvent.detailsJson (PROFILE_UPDATE,
 * MANUAL_PAYOUT_EXECUTED). Runs only before the insert-only trigger exists: the first bootstrap
 * with this code scrubs, then installs the trigger; later runs skip (new events hold last 4 only).
 */
export async function scrubLegacyAuditIbans(db: PrismaClient, log: Log = console.log): Promise<number> {
  if (await auditGuardInstalled(db)) {
    log("[audit-scrub] AuditEvent is already insert-only; legacy IBAN scrub skipped (it ran before the guard was installed).");
    return 0;
  }
  const rows = await db.auditEvent.findMany({
    where: { detailsJson: { contains: "iban", mode: "insensitive" } },
    select: { id: true, detailsJson: true },
  });
  let scrubbed = 0;
  for (const row of rows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.detailsJson);
    } catch {
      continue;
    }
    const masked = maskIbanValues(parsed);
    if (!masked.changed) continue;
    await db.auditEvent.update({ where: { id: row.id }, data: { detailsJson: JSON.stringify(masked.value) } });
    scrubbed++;
  }
  log(`[audit-scrub] Masked full bank account numbers in ${scrubbed} legacy audit event(s)`);
  return scrubbed;
}

/**
 * Supabase (and any PostgREST-style data API) exposes every table in the `public` schema to the
 * `anon` / `authenticated` roles using the project's public anon key. This app never uses that
 * API; it connects as the table owner, which Row-Level Security does not restrict (no FORCE).
 * So: enable RLS on every public table with NO policies (the API roles see nothing), and revoke
 * every privilege the API roles hold, now and for tables created later. Idempotent; skips the
 * role revokes where those roles don't exist (plain Postgres).
 */
export const DATA_API_LOCKDOWN_SQL = `
DO $lockdown$
DECLARE
  t record;
  r text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END
$lockdown$;`;

export interface DataApiExposure {
  tablesWithoutRls: string[];
  tablesReadableByApiRoles: string[];
}

/** Lists public tables still without RLS, and tables the API roles can still read. */
export async function checkDataApiExposure(db: PrismaClient): Promise<DataApiExposure> {
  const noRls = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT c.relname AS tablename FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity ORDER BY 1`;
  const readable = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT DISTINCT table_name AS tablename FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated') ORDER BY 1`;
  return {
    tablesWithoutRls: noRls.map((r) => r.tablename),
    tablesReadableByApiRoles: readable.map((r) => r.tablename),
  };
}

export async function lockDownDataApi(db: PrismaClient, log: Log = console.log): Promise<DataApiExposure> {
  await db.$executeRawUnsafe(DATA_API_LOCKDOWN_SQL);
  const exposure = await checkDataApiExposure(db);
  log(
    `[data-api] RLS on all public tables: ${exposure.tablesWithoutRls.length === 0 ? "yes" : `NO (${exposure.tablesWithoutRls.length} missing)`}; ` +
      `tables granted to anon/authenticated: ${exposure.tablesReadableByApiRoles.length}`
  );
  return exposure;
}

/** Full sequence used by bootstrap: data hygiene first, then the guards. Never throws. */
export async function runFinancialDataProtection(db: PrismaClient, log: Log = console.log) {
  try {
    await encryptLegacyBankDetails(db, log);
  } catch (err) {
    log(`[bank-encryption] FAILED: ${err instanceof Error ? err.message.split("\n").slice(-1)[0] : String(err)}`);
  }
  try {
    await scrubLegacyAuditIbans(db, log);
  } catch (err) {
    log(`[audit-scrub] FAILED: ${err instanceof Error ? err.message.split("\n").slice(-1)[0] : String(err)}`);
  }
  await installFinancialDbGuards(db, log).catch((err) => {
    log(`[db-guards] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  });
  await lockDownDataApi(db, log).catch((err) => {
    log(`[data-api] FAILED: ${err instanceof Error ? err.message.split(String.fromCharCode(10)).slice(-1)[0] : String(err)}`);
  });
}
