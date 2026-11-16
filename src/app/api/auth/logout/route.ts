import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { clearMfaPendingCookie } from "../_lib/login";

/**
 * Sign out. POST only: a GET handler would let any link, image or prefetch on
 * another site log the user out (logout CSRF). Next.js answers other methods
 * with 405. Plain HTML forms get a 303 to /login; fetch() callers can use
 * `redirect: "manual"` and navigate themselves.
 */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  clearSessionCookie(res);
  clearMfaPendingCookie(res);
  return res;
}
