import { prisma } from "../src/lib/db";
import {
  UserRole,
  SellerMembershipRole,
  SellerOperationalStatus,
  ProductStatus,
  ProductModerationStatus,
  SellerOrderStatus,
  CustomerOrderStatus,
} from "@prisma/client";
import {
  getSellerProductById,
  updateSellerProduct,
  deleteSellerProduct,
  bulkUpdateSellerVariants,
  importSellerProductsCsv,
} from "../src/modules/sellers/catalog-services";
import {
  getSellerOrderById,
  resolveSellerReturn,
} from "../src/modules/sellers/order-services";
import {
  requestOrderCancellation,
} from "../src/modules/orders/services";
import {
  createReturnRequest,
} from "../src/modules/returns/services";
import {
  removeSellerTeamMember,
  registerSellerAccount,
} from "../src/modules/sellers/services";
import {
  paymentProvider,
  processPaymentWebhook,
} from "../src/modules/payments/services";
import { checkRateLimit } from "../src/lib/rate-limit";
import crypto from "crypto";

async function runSecurityAuditSuite() {
  console.log("=========================================================");
  console.log("🛡️  WIZZ.PK SECURITY, AUTHORIZATION & SELLER ISOLATION AUDIT");
  console.log("=========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const nonce = Date.now().toString().slice(-6);

  // Setup Test Entities: 2 Sellers, 2 Customers, 1 Restricted Admin, 1 Super Admin
  console.log("👥 [SETUP] Provisioning Test Actors (2 Sellers, 2 Customers, 2 Admin Roles)...");

  // 1. Seller Org A
  const sellerA = await registerSellerAccount({
    email: `seller_a_${nonce}@wizz.pk`,
    password: "Password123!",
    firstName: "Indus",
    lastName: "OwnerA",
    tradingName: `Indus Merchant A ${nonce}`,
  });
  await prisma.sellerOrg.update({
    where: { id: sellerA.sellerOrg.id },
    data: { operationalStatus: SellerOperationalStatus.ACTIVE },
  });

  // 2. Seller Org B
  const sellerB = await registerSellerAccount({
    email: `seller_b_${nonce}@wizz.pk`,
    password: "Password123!",
    firstName: "Karachi",
    lastName: "OwnerB",
    tradingName: `Karachi Merchant B ${nonce}`,
  });
  await prisma.sellerOrg.update({
    where: { id: sellerB.sellerOrg.id },
    data: { operationalStatus: SellerOperationalStatus.ACTIVE },
  });

  // 3. Customer A
  const customerA = await prisma.user.create({
    data: {
      email: `customer_a_${nonce}@example.com`,
      passwordHash: "hash",
      firstName: "Customer",
      lastName: "A",
      role: UserRole.CUSTOMER,
      isEmailVerified: true,
    },
  });

  // 4. Customer B
  const customerB = await prisma.user.create({
    data: {
      email: `customer_b_${nonce}@example.com`,
      passwordHash: "hash",
      firstName: "Customer",
      lastName: "B",
      role: UserRole.CUSTOMER,
      isEmailVerified: true,
    },
  });

  // 5. Restricted Catalog Admin
  const catalogAdmin = await prisma.user.create({
    data: {
      email: `catalog_admin_${nonce}@wizz.pk`,
      passwordHash: "hash",
      firstName: "Catalog",
      lastName: "Admin",
      role: UserRole.PLATFORM_CATALOG_ADMIN,
      isEmailVerified: true,
    },
  });

  // 6. Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      email: `super_admin_${nonce}@wizz.pk`,
      passwordHash: "hash",
      firstName: "Super",
      lastName: "Admin",
      role: UserRole.PLATFORM_SUPER_ADMIN,
      isEmailVerified: true,
    },
  });

  // Category
  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: { name: "Audit Tools", slug: `audit-tools-${nonce}` },
    });
  }

  // Create Product owned by Seller A
  const productA = await prisma.product.create({
    data: {
      sellerOrgId: sellerA.sellerOrg.id,
      categoryId: category.id,
      title: `Seller A Precision Hardware ${nonce}`,
      slug: `seller-a-hardware-${nonce}`,
      description: "Seller A audited hardware specification",
      status: ProductStatus.DRAFT,
      moderationStatus: ProductModerationStatus.DRAFT,
      isApprovedByPlatform: false,
      variants: {
        create: {
          sku: `SKU-A-${nonce}`,
          title: "Standard",
          priceMinor: 500000, // PKR 5,000
          inventoryLevel: {
            create: {
              sellerOrgId: sellerA.sellerOrg.id,
              availableUnits: 100,
            },
          },
        },
      },
    },
    include: { variants: true },
  });
  const variantA = productA.variants[0];

  // Create Order for Customer A containing Seller A suborder
  const orderA = await prisma.customerOrder.create({
    data: {
      orderNumber: `ORD-A-${nonce}`,
      customerUserId: customerA.id,
      customerEmail: customerA.email,
      customerPhone: "03001234567",
      shippingAddressJson: JSON.stringify({
        fullName: "Customer A",
        street1: "Secret Residence A",
        city: "Lahore",
      }),
      billingAddressJson: JSON.stringify({}),
      subtotalMinor: 500000,
      shippingMinor: 25000,
      taxMinor: 0,
      discountMinor: 0,
      totalMinor: 525000,
      status: CustomerOrderStatus.PROCESSING,
      sellerOrders: {
        create: {
          sellerOrgId: sellerA.sellerOrg.id,
          sellerOrderNumber: `ORD-A-${nonce}-S1`,
          subtotalMinor: 500000,
          shippingMinor: 25000,
          taxMinor: 0,
          discountMinor: 0,
          totalMinor: 525000,
          platformCommissionMinor: 50000,
          netSellerPayableMinor: 475000,
          status: SellerOrderStatus.CONFIRMED,
          items: {
            create: {
              variantId: variantA.id,
              skuSnapshot: variantA.sku,
              productTitleSnapshot: productA.title,
              variantNameSnapshot: variantA.title,
              unitPriceMinor: 500000,
              quantity: 1,
              subtotalMinor: 500000,
              discountMinor: 0,
              taxMinor: 0,
              totalMinor: 500000,
              commissionRatePercent: 10,
              sellerNameSnapshot: sellerA.sellerOrg.name,
              sellerOrgId: sellerA.sellerOrg.id,
            },
          },
        },
      },
    },
    include: {
      sellerOrders: { include: { items: true } },
    },
  });
  const sellerSuborderA = orderA.sellerOrders[0];
  const orderItemA = sellerSuborderA.items[0];

  console.log("\n🧪 [TEST 1] Cross-Seller Product Isolation & IDOR Protection");
  // 1a. Seller B attempts to view Seller A's product
  try {
    await getSellerProductById(sellerB.sellerOrg.id, productA.id);
    assert(false, "Seller B accessed Seller A's product via IDOR");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("FORBIDDEN"), "Seller B blocked from reading Seller A product");
  }

  // 1b. Seller B attempts to mutate Seller A's product
  try {
    await updateSellerProduct(
      sellerB.sellerOrg.id,
      productA.id,
      { title: "Hacked by Seller B" },
      sellerB.user.id
    );
    assert(false, "Seller B updated Seller A's product");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("FORBIDDEN"), "Seller B blocked from modifying Seller A product");
  }

  // 1c. Seller B attempts to delete Seller A's product
  try {
    await deleteSellerProduct(sellerB.sellerOrg.id, productA.id, sellerB.user.id);
    assert(false, "Seller B deleted Seller A's product");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("FORBIDDEN"), "Seller B blocked from deleting Seller A product");
  }

  // 1d. Seller B attempts bulk update injecting Seller A's variant
  try {
    await bulkUpdateSellerVariants(
      sellerB.sellerOrg.id,
      [{ variantId: variantA.id, priceMinor: 100 }],
      sellerB.user.id
    );
    assert(false, "Seller B updated Seller A variant via bulk update");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("FORBIDDEN"), "Seller B blocked from modifying Seller A variant in bulk update");
  }

  console.log("\n🧪 [TEST 2] Cross-Seller Order Isolation & Fulfillment Protection");
  // 2a. Seller B attempts to inspect Seller A's suborder
  try {
    await getSellerOrderById(sellerB.sellerOrg.id, sellerSuborderA.id);
    assert(false, "Seller B accessed Seller A's suborder details");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("FORBIDDEN"), "Seller B blocked from accessing Seller A suborder");
  }

  console.log("\n🧪 [TEST 3] Customer Order Ownership & IDOR Protection");
  // 3a. Customer B attempts to cancel Customer A's order
  try {
    await requestOrderCancellation(orderA.id, customerB.id, "Malicious cancel");
    assert(false, "Customer B cancelled Customer A's order");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("FORBIDDEN"), "Customer B blocked from cancelling Customer A order");
  }

  // 3b. Customer B attempts to initiate a return on Customer A's order item
  try {
    await createReturnRequest(
      sellerSuborderA.id,
      customerB.id,
      orderItemA.id,
      1,
      "DEFECTIVE",
      "Customer B fraudulent return"
    );
    assert(false, "Customer B requested return on Customer A order");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("FORBIDDEN"), "Customer B blocked from returning items from Customer A order");
  }

  console.log("\n🧪 [TEST 4] Return Resolution Cross-Tenant Isolation");
  // Customer A initiates a legitimate return request
  const returnReqA = await createReturnRequest(
    sellerSuborderA.id,
    customerA.id,
    orderItemA.id,
    1,
    "DEFECTIVE",
    "Customer A verified defect"
  );

  // 4a. Seller B attempts to resolve (approve/reject) Seller A's return request
  try {
    await resolveSellerReturn(sellerB.sellerOrg.id, returnReqA.id, "APPROVED");
    assert(false, "Seller B resolved Seller A's customer return");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("FORBIDDEN"), "Seller B blocked from resolving Seller A return request");
  }

  console.log("\n🧪 [TEST 5] Seller Team Authorization & Privilege Escalation Protection");
  // Add a low-privilege staff member to Seller A
  const staffUser = await prisma.user.create({
    data: {
      email: `staff_a_${nonce}@wizz.pk`,
      passwordHash: "hash",
      firstName: "Staff",
      lastName: "User",
      role: UserRole.CUSTOMER,
      isEmailVerified: true,
      memberships: {
        create: {
          sellerOrgId: sellerA.sellerOrg.id,
          role: SellerMembershipRole.FULFILLMENT_MANAGER,
          isActive: true,
        },
      },
    },
  });

  // 5a. Low-privilege staff member attempts to remove organization OWNER
  try {
    await removeSellerTeamMember(
      sellerA.sellerOrg.id,
      sellerA.membership.id,
      SellerMembershipRole.FULFILLMENT_MANAGER
    );
    assert(false, "Staff member successfully removed organization OWNER");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("FORBIDDEN"), "Staff member blocked from removing organization OWNER");
  }

  // 5b. Regular ADMIN attempts to remove organization OWNER
  try {
    await removeSellerTeamMember(
      sellerA.sellerOrg.id,
      sellerA.membership.id,
      SellerMembershipRole.ADMIN
    );
    assert(false, "Admin successfully removed organization OWNER");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("FORBIDDEN"), "Admin blocked from removing organization OWNER");
  }

  // 5c. Super Admin is authorized to manage memberships
  const superAdminRemovalResult = await removeSellerTeamMember(
    sellerA.sellerOrg.id,
    staffUser.id, // staff membership ID is needed, lookup
    "PLATFORM_SUPER_ADMIN"
  ).catch(async () => {
    const staffMembership = await prisma.sellerMembership.findFirst({
      where: { userId: staffUser.id },
    });
    return removeSellerTeamMember(
      sellerA.sellerOrg.id,
      staffMembership!.id,
      "PLATFORM_SUPER_ADMIN"
    );
  });
  assert(!superAdminRemovalResult.isActive, "Platform Super Admin successfully manages memberships");

  console.log("\n🧪 [TEST 6] CSV Import Cross-Seller SKU Collision Defense");
  // Seller B attempts to import a product using Seller A's SKU
  const importResult = await importSellerProductsCsv(
    sellerB.sellerOrg.id,
    [
      {
        sku: variantA.sku, // Seller A's SKU!
        title: "Malicious SKU Hijack",
        pricePkr: 4999,
        stock: 50,
      },
    ],
    { dryRun: true },
    sellerB.user.id
  );
  assert(importResult.errorCount > 0, "Cross-seller SKU import rejected with error");
  assert(
    importResult.errors[0]?.message.includes("owned by another merchant"),
    `Error specifically flags ownership: "${importResult.errors[0]?.message}"`
  );

  console.log("\n🧪 [TEST 7] Webhook Cryptographic Verification & Replay Protection");
  const webhookPayload = JSON.stringify({
    eventType: "PAYMENT_CONFIRMED",
    externalEventId: `evt_test_${nonce}`,
    orderId: orderA.id,
  });

  // 7a. Forged webhook signature
  const forgedSig = "0000000000000000000000000000000000000000000000000000000000000000";
  const isValidForged = paymentProvider.verifyWebhookSignature(webhookPayload, forgedSig);
  assert(!isValidForged, "Forged webhook signature rejected");

  // 7b. Legitimate HMAC signature with timing-safe verification
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || "local_dev_webhook_signing_secret_998877";
  const legitimateSig = crypto.createHmac("sha256", secret).update(webhookPayload).digest("hex");
  const isValidLegit = paymentProvider.verifyWebhookSignature(webhookPayload, legitimateSig);
  assert(isValidLegit, "Authentic HMAC SHA-256 signature accepted");

  // 7c. Replay protection
  await processPaymentWebhook(
    "SANDBOX",
    `evt_test_${nonce}`,
    "payment_intent.succeeded",
    { orderId: orderA.id },
    legitimateSig,
    webhookPayload
  );
  const replayResult = await processPaymentWebhook(
    "SANDBOX",
    `evt_test_${nonce}`,
    "payment_intent.succeeded",
    { orderId: orderA.id },
    legitimateSig,
    webhookPayload
  );
  assert(replayResult.status === "ALREADY_PROCESSED", "Replayed duplicate webhook detected and rejected safely");

  console.log("\n🧪 [TEST 8] Rate Limiting Protection Against Credential / Account Flooding");
  const rateLimitKey = `audit_rate_limit_test_${nonce}`;
  let triggered429 = false;
  for (let i = 0; i < 15; i++) {
    const res = checkRateLimit(rateLimitKey, { windowMs: 60000, max: 10 });
    if (!res.success) {
      triggered429 = true;
      break;
    }
  }
  assert(triggered429, "Sliding-window rate limiter triggered HTTP 429 after 10 requests");

  console.log("\n=========================================================");
  console.log(`🏁 AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAuditSuite().catch((err) => {
  console.error("FATAL ERROR IN SECURITY AUDIT SUITE:", err);
  process.exit(1);
});
