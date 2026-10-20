import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "@/modules/sellers/services";
import { importSellerProductsCsv, CsvProductRow } from "@/modules/sellers/catalog-services";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

    const { rows, dryRun = false } = await req.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "At least one CSV row is required." }, { status: 400 });
    }

    const result = await importSellerProductsCsv(
      context.sellerOrg.id,
      rows as CsvProductRow[],
      { dryRun: Boolean(dryRun) },
      user.id
    );

    return NextResponse.json({
      success: true,
      dryRun: Boolean(dryRun),
      result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error importing CSV";
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
