/**
 * Production-safe bootstrap, run on every deploy by `npm run deploy:build`.
 *
 * Creates only what the platform needs and only if it is missing:
 *   - the WIZZ.PK Direct first-party store
 *   - the storefront categories
 *   - a platform admin from ADMIN_EMAIL / ADMIN_PASSWORD (created once; never reset
 *     unless ADMIN_RESET_PASSWORD=true)
 * It never creates demo customers or demo passwords and never overwrites edits made
 * in the admin panel.
 *
 * Optional: SEED_DEMO_CATALOG=true also loads the 52-product demo catalog. That
 * script ARCHIVES published products that are not in the demo list, so use it only
 * on staging or before you have real products, then remove the variable.
 */
import { execSync } from "child_process";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { SITE_CONFIG } from "../src/lib/config";
import { SellerOperationalStatus, SellerMembershipRole, UserRole } from "@prisma/client";
import { EXPANSION_CATEGORIES } from "./catalog-expansion";

const BASE_CATEGORIES = [
  { name: "Electronics & Audio", slug: "electronics-audio", description: "Headphones, speakers, chargers and everyday tech.", displayOrder: 1 },
  { name: "Outdoor & Travel Gear", slug: "outdoor-travel-gear", description: "Backpacks, luggage, camping and trail gear.", displayOrder: 2 },
  { name: "Work & Productivity", slug: "work-productivity", description: "Keyboards, monitors, desks and workspace accessories.", displayOrder: 3 },
  { name: "Home & Lifestyle", slug: "home-lifestyle", description: "Home décor, lighting, coffee gear and living essentials.", displayOrder: 4 },
  ...EXPANSION_CATEGORIES,
];

async function main() {
  console.log("[bootstrap] Ensuring platform essentials...");

  // 1. First-party store (admin quick-create and 1P listings use this id)
  const flagship = await prisma.sellerOrg.upsert({
    where: { slug: SITE_CONFIG.flagshipSellerSlug },
    update: {},
    create: {
      id: SITE_CONFIG.flagshipSellerId,
      name: SITE_CONFIG.flagshipSellerName,
      slug: SITE_CONFIG.flagshipSellerSlug,
      legalName: process.env.FLAGSHIP_LEGAL_NAME || SITE_CONFIG.flagshipSellerName,
      contactEmail: SITE_CONFIG.supportEmail,
      operationalStatus: SellerOperationalStatus.ACTIVE,
      commissionRatePercent: 0,
    },
  });
  console.log(`[bootstrap] First-party store: ${flagship.name}`);

  // 2. Categories (created if missing; existing names/descriptions are left as edited)
  let createdCategories = 0;
  for (const cat of BASE_CATEGORIES) {
    const existing = await prisma.category.findUnique({ where: { slug: cat.slug }, select: { id: true } });
    if (!existing) {
      await prisma.category.create({ data: { ...cat, isActive: true } });
      createdCategories++;
    }
  }
  console.log(`[bootstrap] Categories: ${BASE_CATEGORIES.length} expected, ${createdCategories} created`);

  // 3. Platform admin from environment variables
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(password, 12),
          firstName: process.env.ADMIN_FIRST_NAME || "Platform",
          lastName: process.env.ADMIN_LAST_NAME || "Admin",
          role: UserRole.PLATFORM_SUPER_ADMIN,
          isEmailVerified: true,
        },
      });
      // Lets the admin manage WIZZ.PK Direct listings in the Seller Center too
      await prisma.sellerMembership.upsert({
        where: { sellerOrgId_userId: { sellerOrgId: flagship.id, userId: user.id } },
        update: {},
        create: { sellerOrgId: flagship.id, userId: user.id, role: SellerMembershipRole.OWNER },
      });
      console.log(`[bootstrap] Created platform admin ${email}`);
    } else if (process.env.ADMIN_RESET_PASSWORD === "true") {
      await prisma.user.update({
        where: { email },
        data: { passwordHash: await bcrypt.hash(password, 12), role: UserRole.PLATFORM_SUPER_ADMIN },
      });
      console.log(`[bootstrap] Reset password for ${email} (remove ADMIN_RESET_PASSWORD now)`);
    } else {
      console.log(`[bootstrap] Admin ${email} already exists; password unchanged`);
    }
  } else {
    console.log("[bootstrap] ADMIN_EMAIL/ADMIN_PASSWORD not set; no admin created");
  }

  // 4. Optional demo catalog
  if (process.env.SEED_DEMO_CATALOG === "true") {
    console.log("[bootstrap] SEED_DEMO_CATALOG=true: loading the demo catalog...");
    await prisma.$disconnect();
    execSync("npx tsx scripts/seed-complete-diverse-catalog.ts", {
      stdio: "inherit",
      env: { ...process.env, ALLOW_DEMO_SEED: "true" },
    });
  }

  console.log("[bootstrap] Done.");
}

main()
  .catch((err) => {
    console.error("[bootstrap] Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
