import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addressBookSchema, addressUpdateSchema, formatZodError, zodFieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_ADDRESSES = 20;
const ORDER_BY = [{ isDefaultShipping: "desc" as const }, { createdAt: "desc" as const }];

async function listAddresses(userId: string) {
  return prisma.address.findMany({ where: { userId }, orderBy: ORDER_BY });
}

function unauthorized() {
  return NextResponse.json({ error: "Please sign in to manage your addresses." }, { status: 401 });
}

async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// GET /api/account/addresses - the signed-in user's saved addresses
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    return NextResponse.json({ success: true, addresses: await listAddresses(user.id) });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not load your addresses.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}

// POST /api/account/addresses - create a saved address
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const parsed = addressBookSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error), fieldErrors: zodFieldErrors(parsed.error) },
        { status: 400 }
      );
    }
    const input = parsed.data;

    if ((await prisma.address.count({ where: { userId: user.id } })) >= MAX_ADDRESSES) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_ADDRESSES} addresses. Remove one to add another.` },
        { status: 400 }
      );
    }

    const address = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.address.count({ where: { userId: user.id } });
      const makeDefault = Boolean(input.isDefaultShipping) || existingCount === 0;
      if (makeDefault) {
        await tx.address.updateMany({ where: { userId: user.id }, data: { isDefaultShipping: false } });
      }
      return tx.address.create({
        data: {
          userId: user.id,
          title: input.title ?? null,
          fullName: input.fullName,
          phone: input.phone,
          street1: input.street1,
          street2: input.street2 ?? null,
          city: input.city,
          stateProvince: input.stateProvince,
          postalCode: input.postalCode,
          countryCode: input.countryCode,
          isDefaultShipping: makeDefault,
        },
      });
    });

    return NextResponse.json(
      { success: true, address, addresses: await listAddresses(user.id) },
      { status: 201 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not save this address.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}

// PATCH /api/account/addresses
//   { id, isDefaultShipping: true }             -> make this the default
//   { id, ...full address fields }              -> edit the address
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const body = (await readJson(req)) as Record<string, unknown> | null;
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "Address id is required." }, { status: 400 });
    }

    const existing = await prisma.address.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    const isDefaultOnly = body && Object.keys(body).every((k) => k === "id" || k === "isDefaultShipping");

    if (isDefaultOnly) {
      if (body?.isDefaultShipping === true) {
        await prisma.$transaction([
          prisma.address.updateMany({ where: { userId: user.id }, data: { isDefaultShipping: false } }),
          prisma.address.update({ where: { id }, data: { isDefaultShipping: true } }),
        ]);
      }
    } else {
      const parsed = addressUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: formatZodError(parsed.error), fieldErrors: zodFieldErrors(parsed.error) },
          { status: 400 }
        );
      }
      const input = parsed.data;
      await prisma.$transaction(async (tx) => {
        if (input.isDefaultShipping) {
          await tx.address.updateMany({ where: { userId: user.id }, data: { isDefaultShipping: false } });
        }
        await tx.address.update({
          where: { id },
          data: {
            title: input.title ?? null,
            fullName: input.fullName,
            phone: input.phone,
            street1: input.street1,
            street2: input.street2 ?? null,
            city: input.city,
            stateProvince: input.stateProvince,
            postalCode: input.postalCode,
            countryCode: input.countryCode,
            // Un-checking the box never leaves the user without a default; use another address instead.
            ...(input.isDefaultShipping ? { isDefaultShipping: true } : {}),
          },
        });
      });
    }

    const addresses = await listAddresses(user.id);
    return NextResponse.json({ success: true, address: addresses.find((a) => a.id === id), addresses });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not update this address.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}

// DELETE /api/account/addresses?id=... - delete a saved address; promotes another to default if needed
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Address id is required." }, { status: 400 });
    }

    const existing = await prisma.address.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      if (existing.isDefaultShipping) {
        const next = await tx.address.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        });
        if (next) {
          await tx.address.update({ where: { id: next.id }, data: { isDefaultShipping: true } });
        }
      }
    });

    return NextResponse.json({ success: true, addresses: await listAddresses(user.id) });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not remove this address.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}
