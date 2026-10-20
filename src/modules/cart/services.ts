import { prisma } from "@/lib/db";
import { CartStatus } from "@prisma/client";
import { getVariantInventory } from "../inventory/services";

/**
 * Verifies that the caller owns the cart. Cart IDs are never an authorization
 * credential: ownership comes from the authenticated user or the httpOnly guest
 * cart cookie.
 */
export async function assertCartAccess(
  cartId: string,
  caller: { userId?: string | null; guestToken?: string | null }
) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: { id: true, userId: true, sessionToken: true, status: true },
  });
  if (!cart) throw new Error("Cart not found.");

  const ownsByUser = Boolean(caller.userId && cart.userId && cart.userId === caller.userId);
  const ownsByToken = Boolean(!cart.userId && caller.guestToken && cart.sessionToken && cart.sessionToken === caller.guestToken);
  if (!ownsByUser && !ownsByToken) {
    throw new Error("FORBIDDEN: You do not have access to this cart.");
  }
  return cart;
}

export async function getOrCreateCart(sessionToken?: string, userId?: string) {
  let cart = null;

  if (userId) {
    cart = await prisma.cart.findFirst({
      where: { userId, status: CartStatus.ACTIVE },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    media: { where: { isThumbnail: true } },
                    sellerOrg: true,
                  },
                },
                inventoryLevel: true,
              },
            },
          },
        },
      },
    });
  } else if (sessionToken) {
    cart = await prisma.cart.findFirst({
      where: { sessionToken, status: CartStatus.ACTIVE },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    media: { where: { isThumbnail: true } },
                    sellerOrg: true,
                  },
                },
                inventoryLevel: true,
              },
            },
          },
        },
      },
    });
  }

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        userId: userId || null,
        sessionToken: sessionToken || null,
        status: CartStatus.ACTIVE,
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    media: { where: { isThumbnail: true } },
                    sellerOrg: true,
                  },
                },
                inventoryLevel: true,
              },
            },
          },
        },
      },
    });
  }

  return cart;
}

export async function getCartById(cartId: string) {
  return prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  media: { where: { isThumbnail: true } },
                  sellerOrg: true,
                },
              },
              inventoryLevel: true,
            },
          },
        },
      },
    },
  });
}

export async function addItemToCart(cartId: string, variantId: string, quantity: number = 1) {
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  // Check variant exists and is active
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });
  if (!variant || !variant.isActive) {
    throw new Error("ITEM_UNAVAILABLE: This product is not available for purchase.");
  }

  // Check inventory stock availability
  const inventory = await getVariantInventory(variantId);
  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId } },
  });

  const totalDesiredQuantity = (existingItem?.quantity || 0) + quantity;
  if (totalDesiredQuantity > inventory.netSellableUnits) {
    throw new Error(`INSUFFICIENT_STOCK: Only ${inventory.netSellableUnits} units available in stock.`);
  }

  if (existingItem) {
    return prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: totalDesiredQuantity },
    });
  }

  return prisma.cartItem.create({
    data: {
      cartId,
      variantId,
      quantity,
    },
  });
}

export async function updateCartItemQuantity(cartId: string, variantId: string, quantity: number) {
  if (quantity <= 0) {
    return removeCartItem(cartId, variantId);
  }

  const inventory = await getVariantInventory(variantId);
  if (quantity > inventory.netSellableUnits) {
    throw new Error(`INSUFFICIENT_STOCK: Only ${inventory.netSellableUnits} units available.`);
  }

  return prisma.cartItem.update({
    where: { cartId_variantId: { cartId, variantId } },
    data: { quantity },
  });
}

export async function removeCartItem(cartId: string, variantId: string) {
  return prisma.cartItem.deleteMany({
    where: { cartId, variantId },
  });
}

export async function clearCart(cartId: string) {
  return prisma.cartItem.deleteMany({
    where: { cartId },
  });
}

export async function mergeGuestCart(sessionToken: string, userId: string) {
  const guestCart = await prisma.cart.findFirst({
    where: { sessionToken, userId: null, status: CartStatus.ACTIVE },
    include: { items: true },
  });

  if (!guestCart) return;

  if (guestCart.items.length > 0) {
    const userCart = await getOrCreateCart(undefined, userId);

    for (const item of guestCart.items) {
      const inventory = await getVariantInventory(item.variantId);
      const existing = await prisma.cartItem.findUnique({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
      });
      // Merge quantities but never beyond what can actually be sold.
      const merged = Math.min((existing?.quantity || 0) + item.quantity, Math.max(inventory.netSellableUnits, 0));
      if (merged <= 0) continue;

      if (existing) {
        await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: merged } });
      } else {
        await prisma.cartItem.create({
          data: { cartId: userCart.id, variantId: item.variantId, quantity: merged },
        });
      }
    }
  }

  // Mark guest cart converted
  await prisma.cart.update({
    where: { id: guestCart.id },
    data: { status: CartStatus.CONVERTED },
  });
}
