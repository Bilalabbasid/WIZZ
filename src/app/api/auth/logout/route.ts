import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SITE_CONFIG } from "@/lib/config";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(SITE_CONFIG.sessionCookieName);
  return NextResponse.redirect(new URL("/login", req.url), 303);
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(SITE_CONFIG.sessionCookieName);
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
