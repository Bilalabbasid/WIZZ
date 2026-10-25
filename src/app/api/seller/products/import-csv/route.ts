import { NextRequest, NextResponse } from "next/server";
import { importSellerProductsCsv, CsvProductRow } from "@/modules/sellers/catalog-services";
import { requireSellerContext, sellerErrorResponse } from "@/modules/sellers/api-guard";

export async function POST(req: NextRequest) {
  try {
    const { user, sellerOrg } = await requireSellerContext({ catalogWrite: true });

    const { rows, dryRun = false } = await req.json();
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "At least one CSV row is required." }, { status: 400 });
    }
    if (rows.length > 2000) {
      return NextResponse.json({ error: "Import at most 2,000 rows at a time." }, { status: 400 });
    }

    const result = await importSellerProductsCsv(
      sellerOrg.id,
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
    return sellerErrorResponse(err, "Error importing CSV");
  }
}
