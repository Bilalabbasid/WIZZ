import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import { ensureCartToken, getCartToken } from "@/lib/cart-session";
import {
  getActiveCart,
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
    const message = clientErrorMessage(err, "Error updating cart");
    return NextResponse.json({ error: message }, { status: clientErrorStatus(err) });
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

    const cart = await getActiveCart(sessionToken, user?.id);
    if (!cart) return NextResponse.json({ error: "Your cart is empty." }, { status: 404 });
    await updateCartItemQuantity(cart.id, variantId, qty);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Error updating cart item");
    return NextResponse.json({ error: message }, { status: clientErrorStatus(err) });
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

    const cart = await getActiveCart(sessionToken, user?.id);
    if (!cart) return NextResponse.json({ success: true });
    await removeCartItem(cart.id, variantId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Error removing cart item");
    return NextResponse.json({ error: message }, { status: clientErrorStatus(err) });
  }
}
