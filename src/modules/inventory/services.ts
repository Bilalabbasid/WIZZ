import { prisma } from "@/lib/db";
import { Prisma, ReservationStatus, InventoryAdjustmentReason } from "@prisma/client";
import { SITE_CONFIG } from "@/lib/config";

type TxClient = Prisma.TransactionClient;

/**
 * Checks live inventory for a variant.
 */
export async function getVariantInventory(variantId: string) {
  const level = await prisma.inventoryLevel.findUnique({
    where: { variantId },
  });

  if (!level) {
    return { availableUnits: 0, reservedUnits: 0, netSellableUnits: 0 };
  }

  const netSellableUnits = Math.max(0, level.availableUnits - level.reservedUnits);
  return {
    availableUnits: level.availableUnits,
    reservedUnits: level.reservedUnits,
    netSellableUnits,
    isLowStock: netSellableUnits <= level.lowStockThreshold,
    isOutOfStock: netSellableUnits <= 0,
  };
}

/**
 * Concurrency-safe stock reservation for checkout/cart hold.
 * Runs in an interactive transaction with atomic checks to prevent overselling.
 */
export async function createStockReservation(
  variantId: string,
  quantity: number,
  cartId?: string,
  orderId?: string,
  expiryMinutes: number = SITE_CONFIG.reservationExpiryMinutes,
  client?: TxClient
) {
  if (quantity <= 0) {
    throw new Error("Reservation quantity must be greater than zero.");
  }

  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const run = async (tx: TxClient) => {
    // Acquire row-level lock in PostgreSQL to prevent concurrent overselling races on the last unit
    const lockedLevels = await tx.$queryRaw<Array<{ id: string; variantId: string; availableUnits: number; reservedUnits: number }>>`
      SELECT id, "variantId", "availableUnits", "reservedUnits"
      FROM "InventoryLevel"
      WHERE "variantId" = ${variantId}
      FOR UPDATE
    `;

    const level = lockedLevels[0];

    if (!level) {
      throw new Error("Inventory record not found for variant.");
    }

    const netSellableUnits = level.availableUnits - level.reservedUnits;
    if (netSellableUnits < quantity) {
      throw new Error(`INSUFFICIENT_STOCK: Only ${Math.max(0, netSellableUnits)} units available.`);
    }

    // Atomically increment reserved units
    await tx.inventoryLevel.update({
      where: { variantId },
      data: {
        reservedUnits: { increment: quantity },
      },
    });

    // Create reservation record
    const reservation = await tx.inventoryReservation.create({
      data: {
        variantId,
        cartId,
        orderId,
        reservedUnits: quantity,
        expiresAt,
        status: ReservationStatus.ACTIVE,
      },
    });

    return reservation;
  };

  return client ? run(client) : prisma.$transaction(run);
}

/**
 * Sweeper that safely releases expired checkout inventory reservations.
 * Each transition is conditional on the reservation still being ACTIVE, so a
 * concurrent commit can never be double-counted.
 */
export async function cleanupExpiredReservations() {
  const now = new Date();
  const expired = await prisma.inventoryReservation.findMany({
    where: {
      status: ReservationStatus.ACTIVE,
      expiresAt: { lte: now },
    },
  });

  let cleanedCount = 0;
  for (const res of expired) {
    const released = await prisma.$transaction(async (tx) => {
      const flipped = await tx.inventoryReservation.updateMany({
        where: { id: res.id, status: ReservationStatus.ACTIVE },
        data: { status: ReservationStatus.EXPIRED },
      });
      if (flipped.count === 0) return false;

      await tx.inventoryLevel.update({
        where: { variantId: res.variantId },
        data: {
          reservedUnits: { decrement: res.reservedUnits },
        },
      });
      return true;
    });
    if (released) cleanedCount++;
  }

  return { cleanedCount };
}

/**
 * Commits a reservation upon successful order payment / COD placement.
 * Decrements availableUnits and reservedUnits atomically. Safe to call twice:
 * only the call that wins the ACTIVE -> COMMITTED transition moves stock.
 */
export async function commitStockReservation(reservationId: string, client?: TxClient) {
  const run = async (tx: TxClient) => {
    const flipped = await tx.inventoryReservation.updateMany({
      where: { id: reservationId, status: ReservationStatus.ACTIVE },
      data: { status: ReservationStatus.COMMITTED },
    });
    if (flipped.count === 0) return null;

    const reservation = await tx.inventoryReservation.findUniqueOrThrow({
      where: { id: reservationId },
    });

    // Decrement available units and release hold on reserved units
    const updatedLevel = await tx.inventoryLevel.update({
      where: { variantId: reservation.variantId },
      data: {
        availableUnits: { decrement: reservation.reservedUnits },
        reservedUnits: { decrement: reservation.reservedUnits },
      },
    });

    // Log purchase adjustment
    await tx.inventoryAdjustment.create({
      data: {
        variantId: reservation.variantId,
        sellerOrgId: updatedLevel.sellerOrgId,
        deltaUnits: -reservation.reservedUnits,
        balanceAfter: updatedLevel.availableUnits,
        reasonCode: InventoryAdjustmentReason.PURCHASE,
        notes: `Committed checkout reservation ${reservationId}`,
      },
    });

    return reservation;
  };
  return client ? run(client) : prisma.$transaction(run);
}

/**
 * Releases an active reservation if checkout is abandoned or cancelled.
 */
export async function releaseStockReservation(reservationId: string, client?: TxClient) {
  const run = async (tx: TxClient) => {
    const flipped = await tx.inventoryReservation.updateMany({
      where: { id: reservationId, status: ReservationStatus.ACTIVE },
      data: { status: ReservationStatus.RELEASED },
    });
    if (flipped.count === 0) return null;

    const reservation = await tx.inventoryReservation.findUniqueOrThrow({
      where: { id: reservationId },
    });

    await tx.inventoryLevel.update({
      where: { variantId: reservation.variantId },
      data: {
        reservedUnits: { decrement: reservation.reservedUnits },
      },
    });

    return reservation;
  };
  return client ? run(client) : prisma.$transaction(run);
}

/** Commits every ACTIVE reservation that belongs to this order (and only this order). */
export async function commitOrderReservations(orderId: string, tx: TxClient) {
  const reservations = await tx.inventoryReservation.findMany({
    where: { orderId, status: ReservationStatus.ACTIVE },
  });
  for (const r of reservations) {
    await commitStockReservation(r.id, tx);
  }
  return reservations.length;
}

/**
 * Returns stock for a cancelled order: releases ACTIVE holds and restocks COMMITTED ones.
 * `onlyVariantQuantities` limits the restock to specific seller-suborder items.
 */
export async function returnOrderStock(
  orderId: string,
  tx: TxClient,
  opts: {
    reason: string;
    actorUserId?: string | null;
    onlyVariantQuantities?: Array<{ variantId: string; quantity: number; sellerOrgId: string }>;
  }
) {
  const reservations = await tx.inventoryReservation.findMany({
    where: { orderId, status: { in: [ReservationStatus.ACTIVE, ReservationStatus.COMMITTED] } },
  });

  const filter = opts.onlyVariantQuantities
    ? new Map(opts.onlyVariantQuantities.map((v) => [v.variantId, v]))
    : null;

  for (const r of reservations) {
    if (filter && !filter.has(r.variantId)) continue;

    if (r.status === ReservationStatus.ACTIVE) {
      await releaseStockReservation(r.id, tx);
      continue;
    }

    // COMMITTED: availableUnits was already decremented; put the units back.
    const flipped = await tx.inventoryReservation.updateMany({
      where: { id: r.id, status: ReservationStatus.COMMITTED },
      data: { status: ReservationStatus.RELEASED },
    });
    if (flipped.count === 0) continue;

    const level = await tx.inventoryLevel.update({
      where: { variantId: r.variantId },
      data: { availableUnits: { increment: r.reservedUnits } },
    });
    await tx.inventoryAdjustment.create({
      data: {
        variantId: r.variantId,
        sellerOrgId: level.sellerOrgId,
        actorUserId: opts.actorUserId || null,
        deltaUnits: r.reservedUnits,
        balanceAfter: level.availableUnits,
        reasonCode: InventoryAdjustmentReason.RETURN_RESTOCK,
        notes: opts.reason,
      },
    });
  }
}


/**
 * Manual administrative or seller stock adjustment with full audit logging.
 */
export async function adjustInventoryStock(
  variantId: string,
  sellerOrgId: string,
  actorUserId: string,
  deltaUnits: number,
  reasonCode: InventoryAdjustmentReason,
  notes?: string
) {
  return prisma.$transaction(async (tx) => {
    const level = await tx.inventoryLevel.findUnique({
      where: { variantId },
    });

    if (!level) {
      throw new Error("Inventory record not found.");
    }

    const newBalance = level.availableUnits + deltaUnits;
    if (newBalance < 0) {
      throw new Error(`Cannot adjust stock below zero. Current available: ${level.availableUnits}`);
    }

    const updated = await tx.inventoryLevel.update({
      where: { variantId },
      data: { availableUnits: newBalance },
    });

    const adjustment = await tx.inventoryAdjustment.create({
      data: {
        variantId,
        sellerOrgId,
        actorUserId,
        deltaUnits,
        balanceAfter: newBalance,
        reasonCode,
        notes,
      },
    });

    return { level: updated, adjustment };
  });
}
