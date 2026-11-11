import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWishlistForUser, isProductPubliclyVisible } from "./wishlist-data";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

function unauthorized() {
  return NextResponse.json(
    { error: "Please sign in to use your wishlist.", code: "UNAUTHORIZED" },
    { status: 401, headers: NO_STORE }
  );
}

async function readProductId(req: NextRequest): Promise<string> {
  const fromQuery = new URL(req.url).searchParams.get("productId");
  if (fromQuery) return fromQuery.trim();
  try {
    const body = await req.json();
    return typeof body?.productId === "string" ? body.productId.trim() : "";
  } catch {
    return "";
  }
}

// GET /api/wishlist            -> saved items with price/stock
// GET /api/wishlist?idsOnly=1  -> { productIds } for heart buttons
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    if (new URL(req.url).searchParams.get("idsOnly") === "1") {
      const rows = await prisma.wishlistItem.findMany({
        where: { userId: user.id },
        select: { productId: true },
      });
      return NextResponse.json({ productIds: rows.map((r) => r.productId) }, { headers: NO_STORE });
    }

    const items = await getWishlistForUser(user.id);
    return NextResponse.json({ success: true, items }, { headers: NO_STORE });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not load your wishlist.") },
      { status: clientErrorStatus(err, 500), headers: NO_STORE }
    );
  }
}

// POST /api/wishlist { productId } - save a product (idempotent)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const productId = await readProductId(req);
    if (!productId || productId.length > 64) {
      return NextResponse.json({ error: "productId is required." }, { status: 400 });
    }

    if (!(await isProductPubliclyVisible(productId))) {
      return NextResponse.json({ error: "This product is not available." }, { status: 404 });
    }

    const count = await prisma.wishlistItem.count({ where: { userId: user.id } });
    if (count >= 200) {
      return NextResponse.json(
        { error: "Your wishlist is full (200 items). Remove something to save more." },
        { status: 400 }
      );
    }

    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: user.id, productId } },
      create: { userId: user.id, productId },
      update: {},
    });

    return NextResponse.json({ success: true, productId, saved: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not save this product.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}

// DELETE /api/wishlist?productId=... (or JSON body { productId }) - remove a product
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const productId = await readProductId(req);
    if (!productId) {
      return NextResponse.json({ error: "productId is required." }, { status: 400 });
    }

    await prisma.wishlistItem.deleteMany({ where: { userId: user.id, productId } });
    return NextResponse.json({ success: true, productId, saved: false });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not remove this product.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}
