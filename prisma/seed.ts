import {
  PrismaClient,
  UserRole,
  SellerOperationalStatus,
  SellerMembershipRole,
  SellerApplicationStatus,
  ProductStatus,
  DiscountType,
  InventoryAdjustmentReason,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting WIZZ.PK database seeding...");

  // 1. Seed WIZZ.PK Flagship 1P Seller Organization
  const flagshipSeller = await prisma.sellerOrg.upsert({
    where: { slug: "wizz-pk-direct" },
    update: {
      name: "WIZZ.PK Direct",
      operationalStatus: SellerOperationalStatus.ACTIVE,
      contactEmail: "store@wizz.pk",
    },
    create: {
      id: "seller_wizz_pk_1p",
      name: "WIZZ.PK Direct",
      slug: "wizz-pk-direct",
      legalName: "WIZZ.PK Global Commerce Inc.",
      businessType: "Corporation",
      taxId: "TAX-US-99882200",
      operationalStatus: SellerOperationalStatus.ACTIVE,
      contactEmail: "store@wizz.pk",
      contactPhone: "+1 (800) 555-9499",
      commissionRatePercent: 0,
      logoUrl: "/brand/wizz-logo.svg",
    },
  });
  console.log("✅ Seeded Flagship Seller Org:", flagshipSeller.name);

  // 2. Passwords
  const adminPasswordHash = await bcrypt.hash("Admin@Wizz2026!", 10);
  const customerPasswordHash = await bcrypt.hash("Customer@Wizz2026!", 10);
  const applicantPasswordHash = await bcrypt.hash("Seller@Wizz2026!", 10);

  // 3. Seed Platform Admin
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@wizz.pk" },
    update: { role: UserRole.PLATFORM_SUPER_ADMIN },
    create: {
      id: "usr_platform_admin",
      email: "admin@wizz.pk",
      passwordHash: adminPasswordHash,
      firstName: "Platform",
      lastName: "Administrator",
      phone: "+1 (555) 019-2831",
      role: UserRole.PLATFORM_SUPER_ADMIN,
      isEmailVerified: true,
    },
  });

  // Assign admin ownership of flagship org
  await prisma.sellerMembership.upsert({
    where: {
      sellerOrgId_userId: {
        sellerOrgId: flagshipSeller.id,
        userId: adminUser.id,
      },
    },
    update: { role: SellerMembershipRole.OWNER },
    create: {
      sellerOrgId: flagshipSeller.id,
      userId: adminUser.id,
      role: SellerMembershipRole.OWNER,
    },
  });
  console.log("✅ Seeded Platform Super Admin:", adminUser.email);

  // 4. Seed Standard Customer
  const customerUser = await prisma.user.upsert({
    where: { email: "customer@wizz.pk" },
    update: {},
    create: {
      id: "usr_customer_demo",
      email: "customer@wizz.pk",
      passwordHash: customerPasswordHash,
      firstName: "Sarah",
      lastName: "Jenkins",
      phone: "+1 (555) 742-1923",
      role: UserRole.CUSTOMER,
      isEmailVerified: true,
      addresses: {
        create: {
          title: "Home",
          fullName: "Sarah Jenkins",
          phone: "+1 (555) 742-1923",
          street1: "742 Evergreen Terrace",
          city: "Seattle",
          stateProvince: "WA",
          postalCode: "98101",
          countryCode: "US",
          isDefaultShipping: true,
          isDefaultBilling: true,
        },
      },
    },
  });
  console.log("✅ Seeded Customer:", customerUser.email);

  // 5. Seed Seller Applicant
  const applicantUser = await prisma.user.upsert({
    where: { email: "applicant@craftgear.com" },
    update: {},
    create: {
      id: "usr_applicant_demo",
      email: "applicant@craftgear.com",
      passwordHash: applicantPasswordHash,
      firstName: "David",
      lastName: "Vance",
      phone: "+1 (555) 831-4099",
      role: UserRole.CUSTOMER,
      isEmailVerified: true,
    },
  });

  // Seed sample submitted application
  const existingApp = await prisma.sellerApplication.findFirst({
    where: { applicantUserId: applicantUser.id },
  });

  if (!existingApp) {
    const app = await prisma.sellerApplication.create({
      data: {
        applicantUserId: applicantUser.id,
        legalBusinessName: "CraftGear Outfitters LLC",
        tradingName: "CraftGear Adventure Equipment",
        businessRegNumber: "REG-US-887410",
        taxVatNumber: "VAT-US-99120",
        countryCode: "US",
        city: "Portland",
        addressLine: "1280 Waterfront Way, Suite 400",
        websiteUrl: "https://craftgear-outdoors.example",
        contactName: "David Vance",
        contactEmail: "david@craftgear.com",
        contactPhone: "+1 (555) 831-4099",
        notes: "We manufacture premium titanium campware and trail gear. Seeking marketplace launch on WIZZ.PK.",
        status: SellerApplicationStatus.SUBMITTED,
        submittedAt: new Date(),
        events: {
          create: [
            {
              actorUserId: applicantUser.id,
              fromStatus: SellerApplicationStatus.DRAFT,
              toStatus: SellerApplicationStatus.SUBMITTED,
              note: "Applicant completed initial KYC verification submission.",
            },
          ],
        },
      },
    });
    console.log("✅ Seeded Seller Application:", app.tradingName);
  }

  // 6. Seed Categories
  const categoriesData = [
    {
      name: "Electronics & Audio",
      slug: "electronics-audio",
      description: "Precision engineered acoustics, high-fidelity wireless devices, and flagship tech essentials.",
      displayOrder: 1,
    },
    {
      name: "Outdoor & Travel Gear",
      slug: "outdoor-travel-gear",
      description: "Rugged, weatherproof travel packs, tactical flasks, and engineered trail accessories.",
      displayOrder: 2,
    },
    {
      name: "Work & Productivity",
      slug: "work-productivity",
      description: "Ergonomic mechanical hardware, studio desktop lighting, and desk architecture.",
      displayOrder: 3,
    },
    {
      name: "Home & Lifestyle",
      slug: "home-lifestyle",
      description: "Minimalist home aesthetics, smart ambient systems, and modern living accessories.",
      displayOrder: 4,
    },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
    categories[cat.slug] = record.id;
  }
  console.log("✅ Seeded Categories:", Object.keys(categories).length);

  // 7. Seed Brands
  const brandsData = [
    { name: "WIZZ Core", slug: "wizz-core", description: "Flagship first-party hardware engineered by WIZZ.PK" },
    { name: "AeroGlide", slug: "aeroglide", description: "Ultralight travel and performance materials" },
    { name: "LuminaCraft", slug: "luminacraft", description: "Architectural workspace illumination" },
    { name: "ApexTech", slug: "apextech", description: "Tactile mechanical computing peripherals" },
  ];

  const brands: Record<string, string> = {};
  for (const b of brandsData) {
    const record = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name },
      create: b,
    });
    brands[b.slug] = record.id;
  }
  console.log("✅ Seeded Brands:", Object.keys(brands).length);

  // 8. Seed Catalog Products with Variants and Inventory
  const productsData = [
    {
      title: "WIZZ.PK Horizon Pro Wireless ANC Headphones",
      slug: "wizz-horizon-pro-anc-headphones",
      description: "Engineered with custom 45mm neodymium drivers, hybrid active noise cancellation, 42-hour continuous battery life, and plush memory-foam earpads wrapped in vegan leather.",
      categorySlug: "electronics-audio",
      brandSlug: "wizz-core",
      featured: true,
      weightGrams: 285,
      variants: [
        {
          sku: "WZ-HP-ANC-BLK",
          title: "Matte Midnight",
          priceMinor: 24999, // $249.99
          compareAtPriceMinor: 29999, // $299.99
          costPriceMinor: 11000,
          attributes: { color: "Matte Midnight", edition: "Standard" },
          stock: 65,
        },
        {
          sku: "WZ-HP-ANC-SLV",
          title: "Platinum Silver",
          priceMinor: 24999, // $249.99
          compareAtPriceMinor: 29999,
          costPriceMinor: 11000,
          attributes: { color: "Platinum Silver", edition: "Standard" },
          stock: 42,
        },
      ],
      media: [
        {
          url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80",
          altText: "WIZZ.PK Horizon Pro Headphones Angle View",
          isThumbnail: true,
        },
        {
          url: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=80",
          altText: "WIZZ.PK Horizon Pro Headphones Lifestyle",
          isThumbnail: false,
        },
      ],
    },
    {
      title: "WIZZ.PK Alpine Thermal Travel Backpack 35L",
      slug: "wizz-alpine-thermal-travel-backpack-35l",
      description: "Crafted from 840D ballistic recycled Cordura with weather-sealed YKK Aquaguard zippers. Features a dedicated TSA-approved 16\" laptop sleeve, concealed passport compartment, and ergonomic air-mesh harness.",
      categorySlug: "outdoor-travel-gear",
      brandSlug: "aeroglide",
      featured: true,
      weightGrams: 1150,
      variants: [
        {
          sku: "WZ-ALP-BP-OBS",
          title: "Obsidian Black / 35L",
          priceMinor: 13999, // $139.99
          compareAtPriceMinor: 16999,
          costPriceMinor: 5800,
          attributes: { color: "Obsidian Black", capacity: "35L" },
          stock: 80,
        },
        {
          sku: "WZ-ALP-BP-MST",
          title: "Forest Moss / 35L",
          priceMinor: 13999,
          compareAtPriceMinor: 16999,
          costPriceMinor: 5800,
          attributes: { color: "Forest Moss", capacity: "35L" },
          stock: 35,
        },
      ],
      media: [
        {
          url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80",
          altText: "WIZZ.PK Alpine Travel Backpack",
          isThumbnail: true,
        },
      ],
    },
    {
      title: "WIZZ.PK Apex Ergonomic Mechanical Keyboard",
      slug: "wizz-apex-mechanical-keyboard",
      description: "CNC-milled anodized aluminum chassis with hot-swappable PCB, gasket mount dampening, South-facing RGB, and pre-lubed mechanical switches with PBT dye-sub keycaps.",
      categorySlug: "work-productivity",
      brandSlug: "apextech",
      featured: true,
      weightGrams: 980,
      variants: [
        {
          sku: "WZ-APX-KB-TAC",
          title: "Tactile Silent / Gray",
          priceMinor: 17999, // $179.99
          compareAtPriceMinor: 21999,
          costPriceMinor: 8200,
          attributes: { switch: "Tactile Silent", finish: "Space Gray" },
          stock: 50,
        },
        {
          sku: "WZ-APX-KB-LIN",
          title: "Linear Smooth / Gray",
          priceMinor: 17999,
          compareAtPriceMinor: 21999,
          costPriceMinor: 8200,
          attributes: { switch: "Linear Smooth", finish: "Space Gray" },
          stock: 45,
        },
      ],
      media: [
        {
          url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=80",
          altText: "WIZZ.PK Apex Mechanical Keyboard Top View",
          isThumbnail: true,
        },
      ],
    },
    {
      title: "WIZZ.PK Lumina Desk Ambient Light Bar",
      slug: "wizz-lumina-desk-light-bar",
      description: "Asymmetric optical design illuminating your workspace without screen glare. Touch-sensitive wireless controller with stepless color temperature adjustment (2700K - 6500K) and auto-dimming sensor.",
      categorySlug: "work-productivity",
      brandSlug: "luminacraft",
      featured: false,
      weightGrams: 520,
      variants: [
        {
          sku: "WZ-LUM-LB-STD",
          title: "Standard / Dark Titanium",
          priceMinor: 8999, // $89.99
          compareAtPriceMinor: 10999,
          costPriceMinor: 3800,
          attributes: { finish: "Dark Titanium" },
          stock: 90,
        },
      ],
      media: [
        {
          url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1000&q=80",
          altText: "WIZZ.PK Lumina Light Bar",
          isThumbnail: true,
        },
      ],
    },
    {
      title: "WIZZ.PK HydroShield Insulated Flask 1000ml",
      slug: "wizz-hydroshield-insulated-flask",
      description: "Double-wall vacuum insulated 18/8 pro-grade stainless steel with powder-coat finish. Keeps liquids ice-cold for 24 hours or piping hot for 12 hours. Zero condensation, leakproof cap.",
      categorySlug: "outdoor-travel-gear",
      brandSlug: "aeroglide",
      featured: false,
      weightGrams: 410,
      variants: [
        {
          sku: "WZ-HYD-FL-BLK",
          title: "Matte Black / 1000ml",
          priceMinor: 3499, // $34.99
          compareAtPriceMinor: 4299,
          costPriceMinor: 1200,
          attributes: { color: "Matte Black", capacity: "1000ml" },
          stock: 120,
        },
        {
          sku: "WZ-HYD-FL-BLU",
          title: "Slate Blue / 1000ml",
          priceMinor: 3499,
          compareAtPriceMinor: 4299,
          costPriceMinor: 1200,
          attributes: { color: "Slate Blue", capacity: "1000ml" },
          stock: 95,
        },
      ],
      media: [
        {
          url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1000&q=80",
          altText: "WIZZ.PK HydroShield Flask",
          isThumbnail: true,
        },
      ],
    },
    {
      title: "WIZZ.PK AeroCharge 100W GaN Travel Charger",
      slug: "wizz-aerocharge-100w-gan-charger",
      description: "Next-gen Gallium Nitride (GaN) fast charger delivering 100W PD output across 3 USB-C and 1 USB-A ports. Foldable prongs and universal plug adapters for US, UK, and EU outlets.",
      categorySlug: "electronics-audio",
      brandSlug: "wizz-core",
      featured: true,
      weightGrams: 210,
      variants: [
        {
          sku: "WZ-CHG-100W-WHT",
          title: "Polar White / Multi-Port",
          priceMinor: 5999, // $59.99
          compareAtPriceMinor: 7499,
          costPriceMinor: 2400,
          attributes: { color: "Polar White", wattage: "100W" },
          stock: 110,
        },
      ],
      media: [
        {
          url: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1000&q=80",
          altText: "WIZZ.PK AeroCharge GaN Adapter",
          isThumbnail: true,
        },
      ],
    },
  ];

  for (const prod of productsData) {
    const categoryId = categories[prod.categorySlug];
    const brandId = brands[prod.brandSlug];

    const product = await prisma.product.upsert({
      where: { slug: prod.slug },
      update: {
        title: prod.title,
        description: prod.description,
        featured: prod.featured,
        categoryId,
        brandId,
        status: ProductStatus.PUBLISHED,
        isApprovedByPlatform: true,
      },
      create: {
        sellerOrgId: flagshipSeller.id,
        title: prod.title,
        slug: prod.slug,
        description: prod.description,
        categoryId,
        brandId,
        status: ProductStatus.PUBLISHED,
        isApprovedByPlatform: true,
        featured: prod.featured,
        weightGrams: prod.weightGrams,
      },
    });

    // Seed Media
    for (let i = 0; i < prod.media.length; i++) {
      const m = prod.media[i];
      const existingMedia = await prisma.productMedia.findFirst({
        where: { productId: product.id, url: m.url },
      });
      if (!existingMedia) {
        await prisma.productMedia.create({
          data: {
            productId: product.id,
            url: m.url,
            altText: m.altText,
            displayOrder: i,
            isThumbnail: m.isThumbnail,
          },
        });
      }
    }

    // Seed Variants & Stock
    for (const v of prod.variants) {
      const variant = await prisma.productVariant.upsert({
        where: {
          productId_sku: {
            productId: product.id,
            sku: v.sku,
          },
        },
        update: {
          title: v.title,
          priceMinor: v.priceMinor,
          compareAtPriceMinor: v.compareAtPriceMinor,
          costPriceMinor: v.costPriceMinor,
          attributesJson: JSON.stringify(v.attributes),
          isActive: true,
        },
        create: {
          productId: product.id,
          sku: v.sku,
          title: v.title,
          priceMinor: v.priceMinor,
          compareAtPriceMinor: v.compareAtPriceMinor,
          costPriceMinor: v.costPriceMinor,
          attributesJson: JSON.stringify(v.attributes),
          isActive: true,
        },
      });

      // Seed Inventory Level
      await prisma.inventoryLevel.upsert({
        where: { variantId: variant.id },
        update: {
          availableUnits: v.stock,
          reservedUnits: 0,
        },
        create: {
          variantId: variant.id,
          sellerOrgId: flagshipSeller.id,
          availableUnits: v.stock,
          reservedUnits: 0,
          safetyStock: 5,
          lowStockThreshold: 10,
        },
      });

      // Log initial receiving adjustment
      const existingAdjustment = await prisma.inventoryAdjustment.findFirst({
        where: { variantId: variant.id },
      });
      if (!existingAdjustment) {
        await prisma.inventoryAdjustment.create({
          data: {
            variantId: variant.id,
            sellerOrgId: flagshipSeller.id,
            actorUserId: adminUser.id,
            deltaUnits: v.stock,
            balanceAfter: v.stock,
            reasonCode: InventoryAdjustmentReason.RECEIVING,
            notes: "Initial inventory receiving for WIZZ.PK store launch.",
          },
        });
      }
    }
  }
  console.log("✅ Seeded Catalog Products, Variants & Inventory Levels");

  // 9. Seed Promotional Coupons
  const couponsData = [
    {
      code: "WIZZ10",
      description: "10% off storewide on orders over $30.00",
      discountType: DiscountType.PERCENTAGE,
      discountValueMinor: 10, // 10%
      minOrderAmountMinor: 3000, // $30.00
      maxDiscountMinor: 5000, // $50.00 cap
      isActive: true,
    },
    {
      code: "WELCOME20",
      description: "$20.00 off orders over $100.00",
      discountType: DiscountType.FIXED_AMOUNT,
      discountValueMinor: 2000, // $20.00
      minOrderAmountMinor: 10000, // $100.00
      maxDiscountMinor: 2000,
      isActive: true,
    },
  ];

  for (const c of couponsData) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { isActive: c.isActive },
      create: c,
    });
  }
  console.log("✅ Seeded Promotional Coupons");

  // 10. Seed Platform Configuration Settings
  const settingsData = [
    { key: "SITE_NAME", valueJson: JSON.stringify("WIZZ.PK"), category: "GENERAL", isPublic: true },
    { key: "SUPPORT_EMAIL", valueJson: JSON.stringify("support@wizz.pk"), category: "GENERAL", isPublic: true },
    { key: "SUPPORT_PHONE", valueJson: JSON.stringify("+1 (800) 555-WIZZ"), category: "GENERAL", isPublic: true },
    { key: "RETURN_WINDOW_DAYS", valueJson: JSON.stringify(30), category: "POLICIES", isPublic: true },
    { key: "FREE_SHIPPING_THRESHOLD_CENTS", valueJson: JSON.stringify(5000), category: "SHIPPING", isPublic: true },
  ];

  for (const s of settingsData) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: { valueJson: s.valueJson },
      create: s,
    });
  }
  console.log("✅ Seeded Platform Settings");

  console.log("🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
