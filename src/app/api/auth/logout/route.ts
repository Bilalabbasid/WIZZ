import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SITE_CONFIG } from "@/lib/config";

/**
 * Sign out. POST only: a GET handler would let any link, image or prefetch on
 * another site log the user out (logout CSRF). Next.js answers other methods
 * with 405. Plain HTML forms get a 303 to /login; fetch() callers can use
 * `redirect: "manual"` and navigate themselves.
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(SITE_CONFIG.sessionCookieName);
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
