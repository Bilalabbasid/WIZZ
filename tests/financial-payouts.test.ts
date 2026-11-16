/**
 * Financial payout & bank-detail security suite (local DB, isolated data per run).
 *
 * Covers: IBAN encryption at rest and masking, protected bank changes (password, history,
 * 72-hour payout hold), maker-checker payouts (idempotency, double approval, concurrency,
 * cross-seller binding, limits), failed payouts, DB-level immutability guards and balance
 * reconciliation. Ledger and audit rows cannot be deleted (by design), so test data stays.
 */
import { randomUUID } from "crypto";
import { PayoutRequestStatus, SellerMembershipRole, SellerOperationalStatus, SettlementEntryType, SettlementStatus, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { decryptField, encryptField, isEncryptedValue } from "../src/lib/crypto";
import { SITE_CONFIG } from "../src/lib/config";
import { ADMIN_ACTION_ROLES } from "../src/modules/admin/access";
import {
  approvePayoutRequest,
  createPayoutRequest,
  getSellerPayoutSummary,
  markPayoutRequestFailed,
  PAYOUT_LIMITS,
  rejectPayoutRequest,
  revealSellerBankDetails,
} from "../src/modules/admin/finance";
import { getSellerBalances, getSellerSettlementStatement } from "../src/modules/sellers/order-services";
import {
  changeSellerBankAccount,
  getSellerApplicationByUserId,
  getSellerBankView,
  getSellerContextForUser,
  maskStoredIban,
  saveApplicationDraft,
  submitSellerApplication,
  toStoredIban,
  updateSellerOrgProfile,
} from "../src/modules/sellers/services";

let passed = 0;
let failed = 0;
function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${details ? ` (${details})` : ""}`);
    failed++;
  }
}

async function caught(fn: () => Promise<unknown>): Promise<(Error & { status?: number }) | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    return err as Error & { status?: number };
  }
}

/** Runs `fn` in a transaction that is always rolled back; returns the DB error, or null if `fn` succeeded. */
async function inRolledBackTx(fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<unknown>) {
  const ROLLBACK = "__rollback__";
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Error(ROLLBACK);
    });
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return message === ROLLBACK ? null : message;
  }
}

const run = Date.now().toString(36);
const PASSWORD = "Correct-Horse-Battery-9";

async function makeUser(label: string, role: UserRole, passwordHash: string) {
  return prisma.user.create({
    data: { email: `fin.${label}.${run}@example.test`, passwordHash, firstName: label, lastName: "Tester", role, isEmailVerified: true },
  });
}

async function makeSeller(label: string, iban: string, ownerId: string) {
  const org = await prisma.sellerOrg.create({
    data: {
      name: `Payout ${label} ${run}`,
      slug: `payout-${label}-${run}`,
      legalName: `Payout ${label} (Pvt) Ltd`,
      contactEmail: `payout.${label}.${run}@example.test`,
      operationalStatus: SellerOperationalStatus.ACTIVE,
      bankName: "Meezan Bank",
      bankAccountTitle: `Payout ${label} (Pvt) Ltd`,
      bankIban: toStoredIban(iban),
    },
  });
  await prisma.sellerMembership.create({ data: { sellerOrgId: org.id, userId: ownerId, role: SellerMembershipRole.OWNER } });
  return org;
}

async function credit(sellerOrgId: string, amountMinor: number, status: SettlementStatus, entryType: SettlementEntryType = SettlementEntryType.ORDER_CREDIT) {
  return prisma.settlementLedger.create({
    data: { sellerOrgId, entryType, amountMinor, balanceAfterMinor: 0, status, description: `Test ${entryType} ${status}` },
  });
}

async function main() {
  console.log("=========================================================");
  console.log("💸 WIZZ.PK FINANCIAL PAYOUTS & BANK DETAILS SECURITY SUITE");
  console.log("=========================================================");

  const pwHash = await hashPassword(PASSWORD);
  const financeA = await makeUser("financeA", UserRole.PLATFORM_FINANCE_ADMIN, pwHash);
  const financeB = await makeUser("financeB", UserRole.PLATFORM_FINANCE_ADMIN, pwHash);
  const owner1 = await makeUser("owner1", UserRole.CUSTOMER, pwHash);
  const catalogMgr = await makeUser("catalog1", UserRole.CUSTOMER, pwHash);
  const owner2 = await makeUser("owner2", UserRole.CUSTOMER, pwHash);
  const owner3 = await makeUser("owner3", UserRole.CUSTOMER, pwHash);

  const IBAN1 = "PK36MEZN0001234567891111";
  const IBAN2 = "PK36MEZN0001234567892222";
  const IBAN3 = "PK36MEZN0001234567893333";
  const IBAN3_NEW = "PK36HABB0009876543214444";
  const s1 = await makeSeller("s1", IBAN1, owner1.id);
  const s2 = await makeSeller("s2", IBAN2, owner2.id);
  const s3 = await makeSeller("s3", IBAN3, owner3.id);
  await prisma.sellerMembership.create({ data: { sellerOrgId: s3.id, userId: catalogMgr.id, role: SellerMembershipRole.CATALOG_MANAGER } });

  // S1: 500k + 300k eligible credits, -50k refund debit, 100k in escrow, 20k held → available 750k
  await credit(s1.id, 500_000, SettlementStatus.ELIGIBLE);
  await credit(s1.id, 300_000, SettlementStatus.ELIGIBLE);
  await credit(s1.id, -50_000, SettlementStatus.ELIGIBLE, SettlementEntryType.REFUND_DEBIT);
  await credit(s1.id, 100_000, SettlementStatus.IN_ESCROW);
  const heldEntry = await credit(s1.id, 20_000, SettlementStatus.HELD);
  await credit(s2.id, 200_000, SettlementStatus.ELIGIBLE);
  await credit(s3.id, 100_000, SettlementStatus.ELIGIBLE);

  // -----------------------------------------------------------------
  console.log("\n🧪 [1] Encryption at rest & masking");
  const ct = encryptField(IBAN1);
  assert(isEncryptedValue(ct) && !ct.includes(IBAN1), "encryptField produces enc:v1 ciphertext without the plaintext");
  assert(decryptField(ct) === IBAN1, "decryptField round-trips the IBAN");
  const raw = await prisma.$queryRaw<Array<{ bankIban: string }>>`SELECT "bankIban" FROM "SellerOrg" WHERE id = ${s1.id}`;
  assert(raw[0]?.bankIban.startsWith("enc:v1:") && !raw[0].bankIban.includes("1111"), "SellerOrg.bankIban is stored as ciphertext in the database");
  assert(maskStoredIban(raw[0]?.bankIban) === "•••• 1111", "maskStoredIban shows only the last 4 digits");

  const applicant = await makeUser("applicant", UserRole.CUSTOMER, pwHash);
  const appFields = {
    legalBusinessName: "Applicant Traders (Pvt) Ltd",
    tradingName: `Applicant ${run}`,
    contactName: "Applicant Tester",
    contactEmail: `applicant.${run}@example.test`,
    contactPhone: "+92 300 1234567",
    city: "Lahore",
    addressLine: "Plot 1, Industrial Area",
    bankName: "HBL",
    bankAccountTitle: "Applicant Traders (Pvt) Ltd",
  };
  const draft = await saveApplicationDraft(applicant.id, { ...appFields, bankIban: "PK36HABB0000001123455555" });
  const draftRaw = await prisma.sellerApplication.findUniqueOrThrow({ where: { id: draft.id }, select: { bankIban: true } });
  assert(draft.bankIban === "•••• 5555", "Application draft response returns the IBAN masked");
  assert(isEncryptedValue(draftRaw.bankIban) && decryptField(draftRaw.bankIban) === "PK36HABB0000001123455555", "SellerApplication.bankIban is stored encrypted");
  const submitted = await submitSellerApplication(applicant.id, { ...appFields, bankIban: "•••• 5555" });
  const submittedRaw = await prisma.sellerApplication.findUniqueOrThrow({ where: { id: submitted.id }, select: { bankIban: true } });
  assert(submitted.status === "SUBMITTED" && submittedRaw.bankIban === draftRaw.bankIban, "Sending the masked IBAN back keeps the encrypted IBAN on file");
  const appView = await getSellerApplicationByUserId(applicant.id);
  assert(appView?.bankIban === "•••• 5555" && !JSON.stringify(appView).includes("enc:v1"), "Application API view never contains the IBAN or its ciphertext");

  const ctx = await getSellerContextForUser(owner1.id);
  const ctxJson = JSON.stringify(ctx);
  assert(ctx?.sellerOrg?.bankIban === "•••• 1111", "Seller context (/api/seller/context) masks the IBAN");
  assert(!ctxJson.includes(IBAN1) && !ctxJson.includes("enc:v1"), "Seller context contains neither the full IBAN nor ciphertext");

  const statement1 = await getSellerSettlementStatement(s1.id);
  const adminSummary1 = await getSellerPayoutSummary(s1.id);
  for (const [label, payload] of [["Seller statement", statement1], ["Admin payout summary", adminSummary1]] as const) {
    const json = JSON.stringify(payload);
    assert(!json.includes(IBAN1) && !json.includes("enc:v1"), `${label} never contains the full IBAN or ciphertext`);
  }
  assert(statement1.sellerOrg.bankIban === "•••• 1111", "Seller statement shows the masked IBAN");

  // -----------------------------------------------------------------
  console.log("\n🧪 [2] Balances (single function for statement, admin view and payouts)");
  const b1 = await getSellerBalances(s1.id);
  assert(b1.availableMinor === 750_000, "Available = Σ ELIGIBLE credits + debits", `got ${b1.availableMinor}`);
  assert(b1.inEscrowMinor === 100_000 && b1.heldMinor === 20_000, "Escrow and held amounts are not payable");
  assert(statement1.summary.eligibleForPayoutMinor === b1.availableMinor && adminSummary1.availableMinor === b1.availableMinor, "Statement and admin view use the same available figure");

  // -----------------------------------------------------------------
  console.log("\n🧪 [3] Profile edits vs protected bank change");
  await updateSellerOrgProfile(s3.id, { name: `Payout s3 renamed ${run}` }, owner3.id);
  const afterProfile = await prisma.sellerOrg.findUniqueOrThrow({ where: { id: s3.id } });
  assert(afterProfile.bankDetailsChangedAt === null && afterProfile.bankIban === s3.bankIban, "Non-bank profile edit needs no password and does not touch bank details or the hold");

  // An open payout request for S3 that the bank change must cancel
  const s3Req = await createPayoutRequest(s3.id, financeA.id, { amountMinor: 50_000, idempotencyKey: randomUUID() });
  assert(s3Req.request.status === PayoutRequestStatus.REQUESTED, "Payout request created before the bank change");

  const bankInput = { bankName: "HBL", bankAccountTitle: "Payout s3 (Pvt) Ltd", bankIban: IBAN3_NEW };
  const byCatalog = await caught(() => changeSellerBankAccount({ sellerOrgId: s3.id, actorUserId: catalogMgr.id, input: { ...bankInput, currentPassword: PASSWORD } }));
  assert(Boolean(byCatalog?.message.startsWith("FORBIDDEN")), "Catalog manager cannot change the payout account");
  const noPw = await caught(() => changeSellerBankAccount({ sellerOrgId: s3.id, actorUserId: owner3.id, input: bankInput }));
  assert(Boolean(noPw?.message.startsWith("VALIDATION")), "Bank change without the current password is refused");
  const wrongPw = await caught(() => changeSellerBankAccount({ sellerOrgId: s3.id, actorUserId: owner3.id, input: { ...bankInput, currentPassword: "wrong-password" } }));
  assert(Boolean(wrongPw?.message.startsWith("VALIDATION")), "Bank change with a wrong password is refused");
  const unchanged = await prisma.sellerOrg.findUniqueOrThrow({ where: { id: s3.id } });
  assert(unchanged.bankIban === s3.bankIban && unchanged.bankDetailsChangedAt === null, "Refused attempts leave the bank account untouched");

  const changed = await changeSellerBankAccount({
    sellerOrgId: s3.id,
    actorUserId: owner3.id,
    input: { ...bankInput, currentPassword: PASSWORD },
    meta: { ipAddress: "127.0.0.9", userAgent: "financial-payouts-test" },
  });
  const s3After = await prisma.sellerOrg.findUniqueOrThrow({ where: { id: s3.id } });
  assert(changed.bankIbanMasked === "•••• 4444" && decryptField(s3After.bankIban) === IBAN3_NEW, "Bank change stores the new IBAN encrypted");
  assert(s3After.bankDetailsChangedAt !== null, "bankDetailsChangedAt is set");
  const history = await prisma.bankAccountChange.findMany({ where: { sellerOrgId: s3.id } });
  assert(
    history.length === 1 && history[0].previousIbanLast4 === "3333" && history[0].newIbanLast4 === "4444" && history[0].ipAddress === "127.0.0.9",
    "BankAccountChange records last 4 old → new, IP and user agent"
  );
  const bankAudit = await prisma.auditEvent.findFirst({ where: { entityId: s3.id, action: "BANK_DETAILS_CHANGED" } });
  assert(Boolean(bankAudit) && !bankAudit!.detailsJson.includes(IBAN3_NEW) && !bankAudit!.detailsJson.includes(IBAN3), "BANK_DETAILS_CHANGED audit has no full account numbers");
  const notes = await prisma.notification.findMany({ where: { sellerOrgId: s3.id, title: "Payout bank account changed" } });
  assert(notes.length === 1 && notes[0].userId === owner3.id && !notes[0].message.includes(IBAN3_NEW), "Owner/admin notified (catalog manager not), without the full IBAN");
  const cancelled = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: s3Req.request.id } });
  assert(cancelled.status === PayoutRequestStatus.REJECTED, "Open payout request to the old account is cancelled by the bank change");
  const view = await getSellerBankView(s3.id, { includeHistory: true });
  assert(view.payoutHoldUntil !== null && view.history.length === 1, "Seller bank view shows the 72-hour hold and history");
  const held = await caught(() => createPayoutRequest(s3.id, financeA.id, { amountMinor: 10_000, idempotencyKey: randomUUID() }));
  assert(held?.status === 409 && /payouts resume at/.test(held.message), "Payout refused during the 72-hour hold after a bank change", held?.message);

  // -----------------------------------------------------------------
  console.log("\n🧪 [4] Maker-checker, idempotency and double approval");
  const key1 = randomUUID();
  const r1 = await createPayoutRequest(s1.id, financeA.id, { amountMinor: 400_000, idempotencyKey: key1, notes: "Weekly payout" });
  assert(r1.request.status === PayoutRequestStatus.REQUESTED && r1.request.bankIbanLast4 === "1111", "Payout request created with IBAN last-4 snapshot");
  const r1Again = await createPayoutRequest(s1.id, financeA.id, { amountMinor: 400_000, idempotencyKey: key1 });
  assert(r1Again.replayed && r1Again.request.id === r1.request.id, "Same idempotency key returns the same request");
  assert((await prisma.payoutRequest.count({ where: { idempotencyKey: key1 } })) === 1, "No second request is created for a replayed key");
  const keyConflict = await caught(() => createPayoutRequest(s1.id, financeA.id, { amountMinor: 1_000, idempotencyKey: key1 }));
  assert(keyConflict?.status === 409, "Reusing a key for a different payout is refused");
  const b1Reserved = await getSellerBalances(s1.id);
  assert(b1Reserved.reservedMinor === 400_000 && b1Reserved.availableMinor === 350_000, "Requested amount is reserved (available drops)");

  const selfApprove = await caught(() => approvePayoutRequest(r1.request.id, financeA.id, { bankReference: `SELF-${run}` }));
  assert(selfApprove?.status === 403, "Requester cannot approve their own payout (maker-checker)");
  const ref1 = `IBFT-${run}-001`;
  const approved = await approvePayoutRequest(r1.request.id, financeB.id, { bankReference: ref1, sellerOrgId: s1.id });
  assert(approved.status === PayoutRequestStatus.APPROVED_PAID && Boolean(approved.ledgerEntryId), "Second finance admin confirms the transfer");
  const doubleApprove = await caught(() => approvePayoutRequest(r1.request.id, financeB.id, { bankReference: `${ref1}-B` }));
  assert(doubleApprove?.status === 409, "Second approval is refused");
  const payoutRows = await prisma.settlementLedger.findMany({ where: { sellerOrgId: s1.id, entryType: SettlementEntryType.MANUAL_PAYOUT } });
  assert(payoutRows.length === 1 && payoutRows[0].amountMinor === -400_000 && payoutRows[0].status === SettlementStatus.SETTLED, "Exactly one MANUAL_PAYOUT debit was written");
  const b1Paid = await getSellerBalances(s1.id);
  assert(b1Paid.availableMinor === 350_000 && b1Paid.reservedMinor === 0 && b1Paid.paidOutMinor === 400_000, "Confirmed payout reduces available exactly once");
  const credits = await prisma.settlementLedger.findMany({ where: { sellerOrgId: s1.id, entryType: SettlementEntryType.ORDER_CREDIT, status: SettlementStatus.ELIGIBLE } });
  assert(credits.length === 2 && credits.reduce((s, c) => s + c.amountMinor, 0) === 800_000, "Credit entries are not split or mutated by the payout");

  // -----------------------------------------------------------------
  console.log("\n🧪 [5] Limits, concurrency and cross-seller binding");
  const tooMuch = await caught(() => createPayoutRequest(s1.id, financeA.id, { amountMinor: 350_001, idempotencyKey: randomUUID() }));
  assert(tooMuch?.status === 409 && /available balance/.test(tooMuch.message), "Amount above the available balance is refused");
  const overCap = await caught(() => createPayoutRequest(s1.id, financeA.id, { amountMinor: PAYOUT_LIMITS.maxSingleMinor + 1, idempotencyKey: randomUUID() }));
  assert(overCap?.status === 409 && /Split it/.test(overCap.message), "Amount above the per-payout cap is refused");

  const results = await Promise.allSettled([
    createPayoutRequest(s1.id, financeA.id, { amountMinor: 350_000, idempotencyKey: randomUUID() }),
    createPayoutRequest(s1.id, financeB.id, { amountMinor: 350_000, idempotencyKey: randomUUID() }),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled");
  assert(ok.length === 1 && results.length === 2, "Two concurrent requests for the full balance: exactly one succeeds", results.map((r) => r.status).join(","));
  const b1Concurrent = await getSellerBalances(s1.id);
  assert(b1Concurrent.reservedMinor === 350_000 && b1Concurrent.availableMinor === 0, "Only one reservation exists after the race");
  const winner = (ok[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof createPayoutRequest>>>).value.request;
  await rejectPayoutRequest(winner.id, financeA.id, { note: "Test: release reservation" });
  assert((await getSellerBalances(s1.id)).availableMinor === 350_000, "Rejecting a request releases its reservation");

  const r2 = await createPayoutRequest(s2.id, financeA.id, { amountMinor: 10_000, idempotencyKey: randomUUID() });
  const wrongSeller = await caught(() => approvePayoutRequest(r2.request.id, financeB.id, { bankReference: `X-${run}`, sellerOrgId: s1.id }));
  assert(wrongSeller?.status === 404, "A request cannot be approved through another seller's binding");
  const sellerAsMaker = await caught(() => createPayoutRequest(s1.id, owner1.id, { amountMinor: 1_000, idempotencyKey: randomUUID() }));
  assert(sellerAsMaker?.status === 403, "A seller account cannot create payouts (service-level role check)");
  const sellerAsChecker = await caught(() => approvePayoutRequest(r2.request.id, owner2.id, { bankReference: `Y-${run}` }));
  assert(sellerAsChecker?.status === 403, "A seller account cannot approve its own payout");
  assert(!ADMIN_ACTION_ROLES.sellerPayouts.includes(UserRole.CUSTOMER), "Payout API routes exclude seller (customer) accounts");

  // Velocity: 3 confirmed payouts per seller per 24h
  await approvePayoutRequest(r2.request.id, financeB.id, { bankReference: `V1-${run}`, sellerOrgId: s2.id });
  for (const n of [2, 3]) {
    const r = await createPayoutRequest(s2.id, financeA.id, { amountMinor: 10_000, idempotencyKey: randomUUID() });
    await approvePayoutRequest(r.request.id, financeB.id, { bankReference: `V${n}-${run}` });
  }
  const fourth = await caught(() => createPayoutRequest(s2.id, financeA.id, { amountMinor: 10_000, idempotencyKey: randomUUID() }));
  assert(fourth?.status === 409 && /last 24 hours/.test(fourth.message), "A 4th payout within 24 hours is refused");
  const dupRef = await createPayoutRequest(s1.id, financeA.id, { amountMinor: 1_000, idempotencyKey: randomUUID() });
  const dupRefErr = await caught(() => approvePayoutRequest(dupRef.request.id, financeB.id, { bankReference: ref1 }));
  assert(dupRefErr?.status === 409, "A bank reference cannot be used twice for the same seller");
  await rejectPayoutRequest(dupRef.request.id, financeB.id, { note: "Test cleanup" });

  await prisma.sellerOrg.update({ where: { id: s2.id }, data: { operationalStatus: SellerOperationalStatus.SUSPENDED } });
  const suspended = await caught(() => createPayoutRequest(s2.id, financeA.id, { amountMinor: 1_000, idempotencyKey: randomUUID() }));
  assert(suspended?.status === 409 && /ACTIVE/.test(suspended.message), "Suspended sellers cannot be paid");
  const firstParty = await prisma.sellerOrg.findFirst({ where: { OR: [{ id: SITE_CONFIG.flagshipSellerId }, { slug: SITE_CONFIG.flagshipSellerSlug }] } });
  if (firstParty) {
    const fp = await caught(() => createPayoutRequest(firstParty.id, financeA.id, { amountMinor: 1_000, idempotencyKey: randomUUID() }));
    assert(fp?.status === 409, "The first-party store is never paid out");
  }

  // -----------------------------------------------------------------
  console.log("\n🧪 [6] Failed payout restores the balance once");
  const failedRes = await markPayoutRequestFailed(r1.request.id, financeA.id, { reason: "Beneficiary account closed", sellerOrgId: s1.id });
  assert(failedRes.request.status === PayoutRequestStatus.FAILED && failedRes.adjustment.amountMinor === 400_000, "Failed payout writes a +400k REV_ adjustment");
  const failAgain = await caught(() => markPayoutRequestFailed(r1.request.id, financeB.id, { reason: "Duplicate click test" }));
  assert(failAgain?.status === 409, "A payout can be marked failed only once");
  const b1Failed = await getSellerBalances(s1.id);
  assert(b1Failed.availableMinor === 750_000 && b1Failed.reversedPayoutsMinor === 400_000, "Available balance restored exactly once");

  // -----------------------------------------------------------------
  console.log("\n🧪 [7] Audit trail & audited IBAN reveal");
  const payoutAudits = await prisma.auditEvent.findMany({ where: { entityType: "PayoutRequest", entityId: { in: [r1.request.id, winner.id] } } });
  const actions = new Set(payoutAudits.map((a) => a.action));
  assert(["PAYOUT_REQUESTED", "PAYOUT_APPROVED", "PAYOUT_REJECTED", "PAYOUT_FAILED"].every((a) => actions.has(a)), "Every payout step writes its audit event");
  assert(payoutAudits.every((a) => !a.detailsJson.includes(IBAN1) && a.detailsJson.includes("1111")), "Payout audits carry last 4 only");
  const revealed = await revealSellerBankDetails(s1.id, financeA.id, "test transfer", { ipAddress: "127.0.0.1", userAgent: "test" });
  assert(revealed.bankIban === IBAN1, "Finance admin can reveal the full IBAN");
  const revealAudit = await prisma.auditEvent.findFirst({ where: { entityId: s1.id, action: "BANK_DETAILS_REVEALED", actorUserId: financeA.id } });
  assert(Boolean(revealAudit) && !revealAudit!.detailsJson.includes(IBAN1), "Reveal is audited (BANK_DETAILS_REVEALED) without the number");
  const sellerReveal = await caught(() => revealSellerBankDetails(s1.id, owner1.id, undefined));
  assert(sellerReveal?.status === 403, "Sellers cannot use the reveal action");

  // -----------------------------------------------------------------
  console.log("\n🧪 [8] Database immutability guards");
  const ledgerRow = payoutRows[0];
  const updAmount = await inRolledBackTx((tx) => tx.settlementLedger.update({ where: { id: ledgerRow.id }, data: { amountMinor: -1 } }));
  assert(Boolean(updAmount && /immutable/i.test(updAmount)), "UPDATE of SettlementLedger.amountMinor is rejected by the DB", updAmount ?? "succeeded");
  const updRef = await inRolledBackTx((tx) => tx.settlementLedger.update({ where: { id: ledgerRow.id }, data: { referenceId: "tampered" } }));
  assert(Boolean(updRef && /immutable/i.test(updRef)), "UPDATE of SettlementLedger.referenceId is rejected by the DB");
  const delLedger = await inRolledBackTx((tx) => tx.settlementLedger.delete({ where: { id: ledgerRow.id } }));
  assert(Boolean(delLedger && /cannot be deleted/i.test(delLedger)), "DELETE of a SettlementLedger row is rejected by the DB");
  const statusUpdate = await inRolledBackTx((tx) => tx.settlementLedger.update({ where: { id: heldEntry.id }, data: { holdReason: "dispute note", status: SettlementStatus.HELD } }));
  assert(statusUpdate === null, "Workflow columns (status/holdReason) can still be updated", statusUpdate ?? "");
  const dupPayout = await inRolledBackTx((tx) =>
    tx.settlementLedger.create({
      data: { sellerOrgId: s1.id, entryType: SettlementEntryType.MANUAL_PAYOUT, amountMinor: -1, balanceAfterMinor: 0, status: SettlementStatus.SETTLED, description: "dup", referenceId: ref1 },
    })
  );
  assert(Boolean(dupPayout), "Partial unique index rejects a second MANUAL_PAYOUT with the same bank reference");
  const auditRow = payoutAudits[0];
  const updAudit = await inRolledBackTx((tx) => tx.auditEvent.update({ where: { id: auditRow.id }, data: { detailsJson: "{}" } }));
  const delAudit = await inRolledBackTx((tx) => tx.auditEvent.delete({ where: { id: auditRow.id } }));
  assert(Boolean(updAudit && /insert-only/i.test(updAudit)) && Boolean(delAudit && /insert-only/i.test(delAudit)), "AuditEvent UPDATE and DELETE are rejected by the DB");
  const anyRefund = await prisma.refund.findFirst({ select: { id: true, amountMinor: true } });
  if (anyRefund) {
    const updRefund = await inRolledBackTx((tx) => tx.refund.update({ where: { id: anyRefund.id }, data: { amountMinor: anyRefund.amountMinor + 1 } }));
    const delRefund = await inRolledBackTx((tx) => tx.refund.delete({ where: { id: anyRefund.id } }));
    assert(Boolean(updRefund && /immutable/i.test(updRefund)) && Boolean(delRefund && /cannot be deleted/i.test(delRefund)), "Refund amount UPDATE and DELETE are rejected by the DB");
  } else {
    console.log("  (no Refund rows in this database; refund guard check skipped)");
  }

  // -----------------------------------------------------------------
  console.log("\n🧪 [9] Reconciliation");
  for (const org of [s1, s2, s3]) {
    const balances = await getSellerBalances(org.id);
    const rows = await prisma.settlementLedger.findMany({ where: { sellerOrgId: org.id } });
    const sumNonReversed = rows.filter((r) => r.status !== SettlementStatus.REVERSED).reduce((s, r) => s + r.amountMinor, 0);
    const payable = rows.filter((r) => r.status === SettlementStatus.ELIGIBLE || r.status === SettlementStatus.SETTLED).reduce((s, r) => s + r.amountMinor, 0);
    const reserved = (await prisma.payoutRequest.aggregate({ where: { sellerOrgId: org.id, status: "REQUESTED" }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0;
    const statement = await getSellerSettlementStatement(org.id);
    const paidByRequests = (await prisma.payoutRequest.aggregate({ where: { sellerOrgId: org.id, status: { in: ["APPROVED_PAID", "FAILED"] } }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0;
    assert(
      sumNonReversed === balances.pendingMinor + balances.inEscrowMinor + balances.heldMinor + balances.ledgerBalanceMinor &&
        balances.ledgerBalanceMinor === payable &&
        balances.availableMinor === payable - reserved &&
        statement.summary.eligibleForPayoutMinor === balances.availableMinor &&
        balances.paidOutMinor === paidByRequests,
      `${org.name}: Σ ledger reconciles with the statement and payout requests`,
      JSON.stringify({ sumNonReversed, payable, reserved, paidByRequests, balances })
    );
  }

  console.log("\n=========================================================");
  console.log(`📊 FINANCIAL PAYOUTS SUITE: ${passed} passed, ${failed} failed`);
  console.log("=========================================================");
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("❌ Suite crashed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
