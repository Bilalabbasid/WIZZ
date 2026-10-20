import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCartToken, getCartToken } from "@/lib/cart-session";
import {
  getOrCreateCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
} from "@/modules/cart/services";

export const dynamic = "force-dynamic";

const MAX_LINE_QUANTITY = 20;

function parseQuantity(value: unknown, fallback = 1): number {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n < 0 || n > MAX_LINE_QUANTITY) {
    throw new Error(`Quantity must be a whole number between 0 and ${MAX_LINE_QUANTITY}.`);
  }
  return n;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const sessionToken = user ? await getCartToken() : await ensureCartToken();

    const { variantId, quantity = 1 } = await req.json();
    if (!variantId || typeof variantId !== "string") {
      return NextResponse.json({ error: "variantId is required" }, { status: 400 });
    }
    const qty = parseQuantity(quantity);
    if (qty === 0) {
      return NextResponse.json({ error: "Quantity must be at least 1." }, { status: 400 });
    }

    const cart = await getOrCreateCart(user ? undefined : sessionToken, user?.id);
    await addItemToCart(cart.id, variantId, qty);

    return NextResponse.json({ success: true, cartId: cart.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error updating cart";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const sessionToken = user ? undefined : await getCartToken();

    const { variantId, quantity } = await req.json();
    if (!variantId || quantity === undefined) {
      return NextResponse.json({ error: "variantId and quantity are required" }, { status: 400 });
    }
    const qty = parseQuantity(quantity);

    const cart = await getOrCreateCart(sessionToken, user?.id);
    await updateCartItemQuantity(cart.id, variantId, qty);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error updating cart item";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const sessionToken = user ? undefined : await getCartToken();

    const { searchParams } = new URL(req.url);
    const variantId = searchParams.get("variantId");
    if (!variantId) {
      return NextResponse.json({ error: "variantId is required" }, { status: 400 });
    }

    const cart = await getOrCreateCart(sessionToken, user?.id);
    await removeCartItem(cart.id, variantId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error removing cart item";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
