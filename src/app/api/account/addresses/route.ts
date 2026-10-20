import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/account/addresses - Retrieve user's saved addresses
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const addresses = await prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, addresses });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching addresses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/account/addresses - Create a new saved address
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title = "Home",
      fullName,
      phone,
      street1,
      street2,
      city,
      stateProvince,
      postalCode,
      countryCode = "PK",
      isDefaultShipping = false,
    } = body;

    if (!fullName || !phone || !street1 || !city || !stateProvince || !postalCode) {
      return NextResponse.json(
        { error: "Full name, phone, street address, city, state/province, and postal code are required." },
        { status: 400 }
      );
    }

    const existingCount = await prisma.address.count({ where: { userId: user.id } });
    const makeDefault = isDefaultShipping || existingCount === 0;

    const address = await prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId: user.id },
          data: { isDefaultShipping: false },
        });
      }

      return tx.address.create({
        data: {
          userId: user.id,
          title: title.trim(),
          fullName: fullName.trim(),
          phone: phone.trim(),
          street1: street1.trim(),
          street2: street2 ? street2.trim() : null,
          city: city.trim(),
          stateProvince: stateProvince.trim(),
          postalCode: postalCode.trim(),
          countryCode: countryCode.trim().toUpperCase(),
          isDefaultShipping: makeDefault,
        },
      });
    });

    return NextResponse.json({ success: true, address }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error saving address";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/account/addresses - Update or set default address
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, isDefaultShipping } = body;

    if (!id) {
      return NextResponse.json({ error: "Address id is required." }, { status: 400 });
    }

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    if (isDefaultShipping) {
      await prisma.$transaction(async (tx) => {
        await tx.address.updateMany({
          where: { userId: user.id },
          data: { isDefaultShipping: false },
        });
        await tx.address.update({
          where: { id },
          data: { isDefaultShipping: true },
        });
      });
    }

    const updated = await prisma.address.findUnique({ where: { id } });
    return NextResponse.json({ success: true, address: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error updating address";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/account/addresses - Delete a saved address
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Address id is required." }, { status: 400 });
    }

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    await prisma.address.delete({ where: { id } });

    // If deleted address was default, promote another address to default
    if (existing.isDefaultShipping) {
      const remaining = await prisma.address.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      if (remaining) {
        await prisma.address.update({
          where: { id: remaining.id },
          data: { isDefaultShipping: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error deleting address";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
