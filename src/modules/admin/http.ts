import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";

/** Request metadata recorded on audit events (no body data, no secrets). */
export function requestAuditMeta(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0]!.trim() : req.headers.get("x-real-ip");
  const userAgent = req.headers.get("user-agent");
  return {
    ipAddress: ipAddress ? ipAddress.slice(0, 64) : null,
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
  };
}

export async function writeAdminAudit(
  tx: Prisma.TransactionClient,
  input: {
    actorUserId: string;
    entityType: string;
    entityId: string;
    action: string;
    details: Record<string, unknown>;
    meta?: { ipAddress: string | null; userAgent: string | null };
  }
) {
  await tx.auditEvent.create({
    data: {
      actorUserId: input.actorUserId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      detailsJson: JSON.stringify(input.details),
      ipAddress: input.meta?.ipAddress ?? null,
      userAgent: input.meta?.userAgent ?? null,
    },
  });
}

/** Thrown by admin services for expected business-rule failures; message is user-safe. */
export class AdminRuleError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "AdminRuleError";
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AdminRuleError("Request body must be valid JSON.");
  }
}

export function zodErrorResponse(error: ZodError) {
  const first = error.issues[0];
  const path = first?.path?.length ? `${first.path.join(".")}: ` : "";
  return NextResponse.json(
    { error: `${path}${first?.message ?? "Invalid input."}`, issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
    { status: 400 }
  );
}

export function adminErrorResponse(err: unknown, fallback: string) {
  if (err instanceof AdminRuleError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const code = (err as { code?: unknown })?.code;
  if (code === "P2002") {
    return NextResponse.json({ error: "A record with this unique value already exists." }, { status: 409 });
  }
  if (code === "P2025") {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }
  // Business-rule messages from services (e.g. "VALIDATION: …") are client errors; anything
  // replaced by the fallback is an internal failure.
  const message = clientErrorMessage(err, fallback);
  const status = message === fallback ? clientErrorStatus(err, 500) : clientErrorStatus(err, 400);
  return NextResponse.json({ error: message }, { status });
}

export function parsePage(value: string | string[] | undefined | null): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

export function firstParam(value: string | string[] | undefined | null): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim().slice(0, 120);
}

export const ADMIN_PAGE_SIZE = 25;
