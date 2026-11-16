import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { changeSellerBankAccount, getSellerBankView, readStoredIban, updateSellerOrgProfile } from "@/modules/sellers/services";
import { requireSellerContext, sellerErrorResponse, STORE_ADMIN_ROLES } from "@/modules/sellers/api-guard";
import { authRequestMeta } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Never return commission, status or internal review fields beyond what the page shows.
// Bank details come from getSellerBankView (masked); the stored IBAN is never selected here.
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
  city: true,
  addressLine: true,
  suspensionReason: true,
} as const;

const text = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v ?? ""), z.string().max(max));

// Only these fields are editable by the seller. Status, slug, commission and legal
// identity are managed by the platform. Bank fields are optional: when present AND different
// from what is on file, the change goes through the protected bank-change flow (password needed).
const profileSchema = z.object({
  name: text(120).refine((v) => v.length >= 2, "Store name must be at least 2 characters."),
  contactEmail: text(200).refine((v) => z.string().email().safeParse(v).success, "Enter a valid contact email."),
  contactPhone: text(30),
  city: text(80),
  addressLine: text(300),
  bankName: z.string().max(120).optional().nullable(),
  bankAccountTitle: z.string().max(160).optional().nullable(),
  bankIban: z.string().max(40).optional().nullable(),
  currentPassword: z.string().max(200).optional(),
});

async function loadProfile(sellerOrgId: string, canManageBank: boolean) {
  const [profile, bank] = await Promise.all([
    prisma.sellerOrg.findUnique({ where: { id: sellerOrgId }, select: PROFILE_SELECT }),
    getSellerBankView(sellerOrgId, { includeHistory: canManageBank }),
  ]);
  return {
    profile: profile
      ? { ...profile, bankName: bank.bankName, bankAccountTitle: bank.bankAccountTitle, bankIban: bank.bankIbanMasked }
      : null,
    bank,
  };
}

function withStatus(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : "";
  if (message.startsWith("RATE_LIMITED")) {
    return NextResponse.json({ error: message.replace(/^RATE_LIMITED:\s*/, "") }, { status: 429 });
  }
  return sellerErrorResponse(err, fallback);
}

export async function GET() {
  try {
    const { sellerOrg, membership } = await requireSellerContext();
    const canEditBank = STORE_ADMIN_ROLES.includes(membership.role);
    const { profile, bank } = await loadProfile(sellerOrg.id, canEditBank);
    return NextResponse.json(
      { success: true, profile, bank, canEditBank },
      { headers: { "Cache-Control": "private, no-store" } }
    );
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

    // Older clients send the bank fields back with the profile. Unchanged values (including the
    // masked "•••• 1234") are ignored; a real change needs the current password.
    const current = await prisma.sellerOrg.findUnique({
      where: { id: sellerOrg.id },
      select: { bankName: true, bankAccountTitle: true, bankIban: true },
    });
    const ibanSent = d.bankIban && !/[•*]/.test(d.bankIban) ? d.bankIban.replace(/\s+/g, "").toUpperCase() : null;
    const bankChanged =
      (d.bankName != null && d.bankName.trim() !== (current?.bankName ?? "")) ||
      (d.bankAccountTitle != null && d.bankAccountTitle.trim() !== (current?.bankAccountTitle ?? "")) ||
      (ibanSent !== null && ibanSent !== readStoredIban(current?.bankIban));

    if (bankChanged) {
      await changeSellerBankAccount({
        sellerOrgId: sellerOrg.id,
        actorUserId: user.id,
        input: {
          bankName: d.bankName ?? current?.bankName ?? "",
          bankAccountTitle: d.bankAccountTitle ?? current?.bankAccountTitle ?? "",
          bankIban: ibanSent ?? readStoredIban(current?.bankIban) ?? "",
          currentPassword: d.currentPassword,
        },
        meta: authRequestMeta(req.headers),
      });
    }

    await updateSellerOrgProfile(
      sellerOrg.id,
      {
        name: d.name,
        contactEmail: d.contactEmail.toLowerCase(),
        contactPhone: d.contactPhone || undefined,
        city: d.city || undefined,
        addressLine: d.addressLine || undefined,
      },
      user.id
    );
    const { profile, bank } = await loadProfile(sellerOrg.id, true);
    return NextResponse.json(
      { success: true, profile, bank, canEditBank: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: unknown) {
    return withStatus(err, "Could not save the store profile.");
  }
}
