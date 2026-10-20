import { NextResponse } from "next/server";
import { getCategories, getAllBrands } from "@/modules/catalog/services";

export async function GET() {
  try {
    const [categories, brands] = await Promise.all([
      getCategories(),
      getAllBrands(),
    ]);

    return NextResponse.json({ success: true, categories, brands });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching taxonomy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
