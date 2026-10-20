import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { runMaintenance } from "@/lib/jobs";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // No fallback secret and no Host-header bypass: if CRON_SECRET is unset the endpoint is closed.
  if (!secret || secret.length < 16 || secret.startsWith("change_me")) {
    return process.env.NODE_ENV !== "production" && req.headers.get("authorization") === "Bearer dev-cron";
  }
  const header = req.headers.get("authorization") || "";
  const provided = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }
  try {
    const result = await runMaintenance();
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    console.error("[cron] maintenance failed", err);
    return NextResponse.json({ error: "Maintenance run failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

/** GET is accepted because many hosted cron schedulers can only issue GET requests. */
export async function GET(req: NextRequest) {
  return handle(req);
}
