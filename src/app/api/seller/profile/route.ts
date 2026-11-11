import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { updateSellerOrgProfile } from "@/modules/sellers/services";
import { requireSellerContext, sellerErrorResponse, STORE_ADMIN_ROLES } from "@/modules/sellers/api-guard";

export const dynamic = "force-dynamic";

// Never return commission, status or internal review fields beyond what the page shows
const PROFILE_SELECT = {
  id: true,
  name: true,
  slug: true,
  legalName: true,
  taxId: true,
  businessType: true,
  operationalStatus: true,
  logoUrl: true,
  contactEmail: true,
  contactPhone: true,
  commissionRatePercent: true,
  bankName: true,
  bankAccountTitle: true,
  bankIban: true,
  city: true,
  addressLine: true,
  suspensionReason: true,
} as const;

const text = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v ?? ""), z.string().max(max));

// Only these fields are editable by the seller. Status, slug, commission and legal
// identity are managed by the platform.
const profileSchema = z.object({
  name: text(120).refine((v) => v.length >= 2, "Store name must be at least 2 characters."),
  contactEmail: text(200).refine((v) => z.string().email().safeParse(v).success, "Enter a valid contact email."),
  contactPhone: text(30),
  city: text(80),
  addressLine: text(300),
  bankName: text(120),
  bankAccountTitle: text(160),
  bankIban: text(40).refine((v) => !v || /^[A-Za-z0-9 ]{10,34}$/.test(v), "IBAN may contain only letters and digits (10-34 characters)."),
});

export async function GET() {
  try {
    const { sellerOrg, membership } = await requireSellerContext();
    const profile = await prisma.sellerOrg.findUnique({ where: { id: sellerOrg.id }, select: PROFILE_SELECT });
    // Bank details are visible to store owners/admins only
    if (profile && !STORE_ADMIN_ROLES.includes(membership.role)) {
      profile.bankIban = profile.bankIban ? `•••• ${profile.bankIban.slice(-4)}` : null;
    }
    return NextResponse.json({ success: true, profile, canEditBank: STORE_ADMIN_ROLES.includes(membership.role) });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Could not load the store profile.");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { sellerOrg, user } = await requireSellerContext({
      roles: STORE_ADMIN_ROLES,
      roleLabel: "edit the store profile",
    });
    const parsed = profileSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
    }
    const d = parsed.data;
    await updateSellerOrgProfile(
      sellerOrg.id,
      {
        name: d.name,
        contactEmail: d.contactEmail.toLowerCase(),
        contactPhone: d.contactPhone || undefined,
        city: d.city || undefined,
        addressLine: d.addressLine || undefined,
        bankName: d.bankName || undefined,
        bankAccountTitle: d.bankAccountTitle || undefined,
        bankIban: d.bankIban ? d.bankIban.replace(/\s+/g, "").toUpperCase() : undefined,
      },
      user.id
    );
    const profile = await prisma.sellerOrg.findUnique({ where: { id: sellerOrg.id }, select: PROFILE_SELECT });
    return NextResponse.json({ success: true, profile, canEditBank: true });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Could not save the store profile.");
  }
}
