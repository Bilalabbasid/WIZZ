import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "@/modules/sellers/services";
import {
  getSellerProductById,
  updateSellerProduct,
  deleteSellerProduct,
} from "@/modules/sellers/catalog-services";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

    const { id } = await params;
    const product = await getSellerProductById(context.sellerOrg.id, id);

    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching product";
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

    const { id } = await params;
    const body = await req.json();

    const product = await updateSellerProduct(context.sellerOrg.id, id, body, user.id);

    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error updating product";
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

    const { id } = await params;
    const product = await deleteSellerProduct(context.sellerOrg.id, id, user.id);

    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error deleting product";
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
