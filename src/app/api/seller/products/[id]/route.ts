import { NextRequest, NextResponse } from "next/server";
import {
  getSellerProductById,
  updateSellerProduct,
  deleteSellerProduct,
} from "@/modules/sellers/catalog-services";
import { requireSellerContext, sellerErrorResponse } from "@/modules/sellers/api-guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { sellerOrg } = await requireSellerContext();
    const { id } = await params;
    const product = await getSellerProductById(sellerOrg.id, id);
    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error fetching product");
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { user, sellerOrg } = await requireSellerContext({ catalogWrite: true });
    const { id } = await params;
    const body = await req.json();
    await updateSellerProduct(sellerOrg.id, id, body, user.id);
    // Return the full, fresh record so the editor can re-sync (new variant ids, stock, deal state)
    const product = await getSellerProductById(sellerOrg.id, id);
    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error updating product");
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { user, sellerOrg } = await requireSellerContext({ catalogWrite: true });
    const { id } = await params;
    const product = await deleteSellerProduct(sellerOrg.id, id, user.id);
    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error deleting product");
  }
}
