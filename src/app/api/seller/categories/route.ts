import { NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { getCategories, getAllBrands } from "@/modules/catalog/services";

export async function GET() {
  try {
    const [categories, brands] = await Promise.all([
      getCategories(),
      getAllBrands(),
    ]);

    return NextResponse.json({ success: true, categories, brands });
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Error fetching taxonomy");
    return NextResponse.json({ error: message }, { status: clientErrorStatus(err) });
  }
}
