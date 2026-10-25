import { prisma } from "../src/lib/db";
import {
  getProducts,
  getProductBySlug,
  getCategories,
} from "../src/modules/catalog/services";
import {
  getOrCreateCart,
  addItemToCart,
  updateCartItemQuantity,
} from "../src/modules/cart/services";
import {
  calculateCheckoutTotals,
  placeOrder,
} from "../src/modules/checkout/services";
import {
  getUserOrders,
  getOrderById,
  reconcileCodPayment,
} from "../src/modules/orders/services";
import {
  createReturnRequest,
  reviewReturnRequest,
  processReturnRestockAndRefund,
} from "../src/modules/returns/services";
import {
  registerSellerAccount,
  getSellerContextForUser,
  submitSellerApplication,
  reviewSellerApplication,
} from "../src/modules/sellers/services";
import {
  createSellerProduct,
  approveProductModeration,
} from "../src/modules/sellers/catalog-services";
import {
  getSellerOrders,
  createSellerShipment,
  updateSellerOrderStatus,
} from "../src/modules/sellers/order-services";
import { adjustInventoryStock } from "../src/modules/inventory/services";
import { createShipment } from "../src/modules/fulfillment/services";
import { hashPassword, createSessionToken } from "../src/lib/auth";
import { SITE_CONFIG } from "../src/lib/config";
import {
  UserRole,
  ProductStatus,
  ProductModerationStatus,
  SellerOrderStatus,
  CustomerOrderStatus,
  InventoryAdjustmentReason,
  SettlementStatus,
} from "@prisma/client";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passCount++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failCount++;
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runE2EFunctionalAudit() {
  console.log("\n=========================================================");
  console.log("🚀 WIZZ.PK EVIDENCE-BASED FUNCTIONAL AUDIT SUITE");
  console.log("=========================================================\n");

  const runId = Date.now().toString().slice(-6);

  // ======================================================================
  // JOURNEY 1: Guest Shopping & Checkout Journey
  // ======================================================================
  console.log("🛒 [JOURNEY 1] Guest Discovers Product, Adds to Cart & Checks Out with COD");

  // Step 1: Product Discovery
  const catalog = await getProducts({ limit: 50 });
  assert(catalog.products.length > 0, "Guest discovers published products in catalog");
  // This journey pays by COD, so pick an in-stock product COD can cover
  const testProduct =
    catalog.products.find((p) =>
      p.variants.some(
        (v) =>
          v.priceMinor * 2 <= SITE_CONFIG.cod.maxOrderLimitMinor &&
          (v.inventoryLevel?.availableUnits ?? 0) - (v.inventoryLevel?.reservedUnits ?? 0) >= 2
      )
    ) ?? catalog.products[0];
  assert(Boolean(testProduct.slug), `Discovered product slug: "${testProduct.slug}"`);

  // Step 2: Product Detail & Variant Selection
  const productDetail = await getProductBySlug(testProduct.slug);
  assert(productDetail !== null, "Guest views product detail page");
  assert(productDetail!.variants.length > 0, "Product has active variants");
  const chosenVariant =
    productDetail!.variants.find((v) => v.priceMinor * 2 <= SITE_CONFIG.cod.maxOrderLimitMinor) ??
    productDetail!.variants[0];
  assert(Boolean(chosenVariant.id), `Selected variant: ${chosenVariant.title} (${chosenVariant.sku})`);

  // Step 3: Guest Cart Management
  const guestSessionToken = `guest_audit_session_${runId}`;
  const guestCart = await getOrCreateCart(guestSessionToken);
  assert(Boolean(guestCart.id), "Guest anonymous shopping cart initialized");

  await addItemToCart(guestCart.id, chosenVariant.id, 2);
  const updatedCart = await getOrCreateCart(guestSessionToken);
  const cartItem = updatedCart.items.find((i) => i.variantId === chosenVariant.id);
  assert(cartItem !== undefined && cartItem.quantity === 2, "Added 2 units of variant to guest cart");

  await updateCartItemQuantity(guestCart.id, chosenVariant.id, 1);
  const recheckedCart = await getOrCreateCart(guestSessionToken);
  const updatedItem = recheckedCart.items.find((i) => i.variantId === chosenVariant.id);
  assert(updatedItem !== undefined && updatedItem.quantity === 1, "Updated quantity to 1 unit in guest cart");

  // Step 4: Checkout Calculation & Coupon Validation
  const totals = await calculateCheckoutTotals(guestCart.id, undefined, "STANDARD");
  assert(totals.subtotalMinor > 0, `Server-calculated subtotal: PKR ${totals.subtotalMinor / 100}`);
  assert(totals.totalMinor >= totals.subtotalMinor, "Order total includes shipping/tax calculations");

  // Step 5: Order Placement with Cash on Delivery
  const guestOrder = await placeOrder({
    cartId: guestCart.id,
    customerEmail: `guest_${runId}@example.com`,
    customerPhone: "+92 300 9876543",
    shippingAddress: {
      fullName: "Ahmed Raza",
      phone: "+92 300 9876543",
      street1: "Flat 4B, Clifton Block 5",
      city: "Karachi",
      stateProvince: "Sindh",
      postalCode: "75600",
      countryCode: "PK",
    },
    billingAddress: {
      fullName: "Ahmed Raza",
      phone: "+92 300 9876543",
      street1: "Flat 4B, Clifton Block 5",
      city: "Karachi",
      stateProvince: "Sindh",
      postalCode: "75600",
      countryCode: "PK",
    },
    shippingTier: "STANDARD",
    idempotencyKey: `idemp_guest_${runId}`,
    paymentMethod: "CASH_ON_DELIVERY",
  });

  assert(Boolean(guestOrder.id), `Guest order placed: ${guestOrder.orderNumber}`);
  assert(guestOrder.customerUserId === null, "Guest order correctly has null customerUserId");
  assert(guestOrder.status === CustomerOrderStatus.PROCESSING, "COD order initialized in PROCESSING status");
  assert(guestOrder.paymentStatus === "UNPAID", "COD payment initialized as UNPAID");

  // Step 6: Guest Receipt Access
  const receipt = await getOrderById(guestOrder.id);
  assert(receipt !== null, "Guest can view order confirmation receipt");
  assert(receipt!.orderNumber === guestOrder.orderNumber, "Receipt displays exact orderNumber");

  // ======================================================================
  // JOURNEY 2: Customer Registration, Address Management, Order Tracking & Returns
  // ======================================================================
  console.log("\n👤 [JOURNEY 2] Customer Registers, Manages Addresses, Places Order & Requests Return");

  const customerEmail = `customer_audit_${runId}@example.com`;
  const passwordHash = await hashPassword("CustomerPass123!");

  const customerUser = await prisma.user.create({
    data: {
      email: customerEmail,
      passwordHash,
      firstName: "Fatima",
      lastName: "Noor",
      phone: "+92 321 4567890",
      role: UserRole.CUSTOMER,
      isEmailVerified: true,
    },
  });
  assert(Boolean(customerUser.id), `Customer account registered: ${customerEmail}`);

  // Test Address Book Management
  const addr1 = await prisma.address.create({
    data: {
      userId: customerUser.id,
      title: "Home",
      fullName: "Fatima Noor",
      phone: "+92 321 4567890",
      street1: "House 12, Street 3, DHA Phase 6",
      city: "Lahore",
      stateProvince: "Punjab",
      postalCode: "54792",
      countryCode: "PK",
      isDefaultShipping: true,
    },
  });
  assert(addr1.isDefaultShipping === true, "Customer added first address marked default");

  const addr2 = await prisma.address.create({
    data: {
      userId: customerUser.id,
      title: "Office",
      fullName: "Fatima Noor (Office)",
      phone: "+92 321 4567890",
      street1: "Plaza 9, Blue Area",
      city: "Islamabad",
      stateProvince: "Islamabad Capital Territory",
      postalCode: "44000",
      countryCode: "PK",
      isDefaultShipping: false,
    },
  });
  assert(addr2.title === "Office", "Customer added second address (Office)");

  // Update default address
  await prisma.$transaction(async (tx) => {
    await tx.address.updateMany({ where: { userId: customerUser.id }, data: { isDefaultShipping: false } });
    await tx.address.update({ where: { id: addr2.id }, data: { isDefaultShipping: true } });
  });
  const updatedAddr2 = await prisma.address.findUnique({ where: { id: addr2.id } });
  assert(updatedAddr2!.isDefaultShipping === true, "Successfully updated default address to Office");

  // Remove first address
  await prisma.address.delete({ where: { id: addr1.id } });
  const remainingAddresses = await prisma.address.findMany({ where: { userId: customerUser.id } });
  assert(remainingAddresses.length === 1, "Successfully removed old home address");

  // Customer Shopping & Order Placement
  const custCart = await getOrCreateCart(undefined, customerUser.id);
  await addItemToCart(custCart.id, chosenVariant.id, 1);

  const customerOrder = await placeOrder({
    cartId: custCart.id,
    customerEmail: customerUser.email,
    customerPhone: customerUser.phone || "+92 321 4567890",
    customerUserId: customerUser.id,
    shippingAddress: {
      fullName: addr2.fullName,
      phone: addr2.phone,
      street1: addr2.street1,
      city: addr2.city,
      stateProvince: addr2.stateProvince,
      postalCode: addr2.postalCode,
      countryCode: addr2.countryCode,
    },
    shippingTier: "STANDARD",
    idempotencyKey: `idemp_cust_${runId}`,
    paymentMethod: "CASH_ON_DELIVERY",
  });

  assert(customerOrder.customerUserId === customerUser.id, "Customer order linked to customer user account");

  // Order Tracking
  const customerOrdersList = await getUserOrders(customerUser.id);
  assert(customerOrdersList.length >= 1, "Customer views order history in account portal");
  const trackedOrder = await getOrderById(customerOrder.id);
  assert(trackedOrder !== null, "Customer tracks active order");

  // Customer Return Request
  const sellerSuborder = trackedOrder!.sellerOrders[0];
  assert(Boolean(sellerSuborder), "Order has partitioned seller suborder");
  const orderItemToReturn = sellerSuborder.items[0];
  assert(Boolean(orderItemToReturn), "Suborder contains item for return");

  const returnReq = await createReturnRequest(
    sellerSuborder.id,
    customerUser.id,
    orderItemToReturn.id,
    1,
    "DAMAGED",
    "Item arrived with broken packaging seal."
  );
  assert(Boolean(returnReq.id), `Return request submitted: ID ${returnReq.id}`);
  assert(returnReq.status === "SUBMITTED", "Return initialized in SUBMITTED state");

  // ======================================================================
  // JOURNEY 3: Admin Creates 1P Product, Adjusts Inventory, Fulfills & Handles Return
  // ======================================================================
  console.log("\n🛡️ [JOURNEY 3] Admin Creates 1P Product, Adjusts Stock, Fulfills Order & Resolves Return");

  // Step 1: Admin Creates 1P Product
  const categories = await getCategories();
  const cat = categories[0];
  const newProductTitle = `WIZZ 1P Precision Tool v${runId}`;
  const newSku = `WZ-TOOL-${runId}`;

  const created1PProduct = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        sellerOrgId: SITE_CONFIG.flagshipSellerId,
        title: newProductTitle,
        slug: `wizz-1p-precision-tool-${runId}`,
        description: "Official 1P precision EDC multi-tool with titanium finish.",
        categoryId: cat.id,
        featured: false,
        weightGrams: 350,
        status: ProductStatus.PUBLISHED,
        isApprovedByPlatform: true,
      },
    });

    const v = await tx.productVariant.create({
      data: {
        productId: p.id,
        sku: newSku,
        title: "Titanium Edition",
        priceMinor: 499900, // PKR 4,999.00
        attributesJson: JSON.stringify({ material: "Titanium" }),
      },
    });

    await tx.inventoryLevel.create({
      data: {
        variantId: v.id,
        sellerOrgId: SITE_CONFIG.flagshipSellerId,
        availableUnits: 50,
        reservedUnits: 0,
      },
    });

    return { product: p, variant: v };
  });

  assert(Boolean(created1PProduct.product.id), `1P Product created: "${created1PProduct.product.title}"`);

  // Step 2: Inventory Adjustment Audit
  const adjResult = await adjustInventoryStock(
    created1PProduct.variant.id,
    SITE_CONFIG.flagshipSellerId,
    customerUser.id,
    10,
    InventoryAdjustmentReason.CYCLE_COUNT,
    "Quarterly audit cycle count adjustment"
  );
  assert(adjResult.level.availableUnits === 60, "Inventory balance correctly adjusted from 50 to 60 units");

  // Step 3: Admin Fulfills Order via Carrier Dispatch
  const waybill = await createShipment(
    sellerSuborder.id,
    "TCS_EXPRESS",
    `TCS-${runId}-7788`,
    `https://tcs.com.pk/track/TCS-${runId}-7788`
  );
  assert(waybill.trackingNumber === `TCS-${runId}-7788`, "Admin generated carrier waybill (TCS)");

  // Step 4: Admin Reconciles COD Courier Payment
  const codReconciled = await reconcileCodPayment(
    customerOrder.id,
    `TCS_CASH_DEP_${runId}`,
    customerUser.id
  );
  assert(codReconciled.paymentStatus === "PAID", "Admin reconciled courier cash collection; order marked PAID");

  // Step 5: Admin Handles and Resolves Customer Return Request
  const approvedReturn = await reviewReturnRequest(returnReq.id, "APPROVED", "Approved upon visual inspection");
  assert(approvedReturn.status === "APPROVED", "Admin approved customer return request");

  const returnOutcome = await processReturnRestockAndRefund(returnReq.id);
  assert(returnOutcome.refunded === true, "Customer refund processed successfully");
  assert(returnOutcome.amountMinor > 0, `Refunded customer: PKR ${returnOutcome.amountMinor / 100}`);

  // ======================================================================
  // JOURNEY 4: Seller Registers, Onboards, Submits Product, Fulfills Suborder
  // ======================================================================
  console.log("\n🏬 [JOURNEY 4] Seller Registers, Completes KYC Onboarding, Submits Listing & Fulfills Suborder");

  // Step 1: Seller Registration
  const sellerEmail = `merchant_audit_${runId}@example.com`;
  const sellerReg = await registerSellerAccount({
    email: sellerEmail,
    password: "MerchantSecret123!",
    firstName: "Bilal",
    lastName: "Tariq",
    phone: "+92 333 5551234",
    tradingName: `Indus Gear Co ${runId}`,
  });
  assert(Boolean(sellerReg.sellerOrg.id), `Seller registered: "${sellerReg.sellerOrg.name}"`);
  assert(sellerReg.sellerOrg.operationalStatus === "INACTIVE", "New seller operationalStatus is INACTIVE");

  // Step 2: KYC Onboarding Application Submission
  const submittedApp = await submitSellerApplication(
    sellerReg.user.id,
    {
      legalBusinessName: `Indus Gear Pvt Ltd ${runId}`,
      tradingName: `Indus Gear Co ${runId}`,
      businessRegNumber: `SEC-PK-${runId}`,
      taxVatNumber: `NTN-9988-${runId}`,
      countryCode: "PK",
      city: "Karachi",
      addressLine: "Plot 45, Korangi Industrial Area",
      contactName: "Bilal Tariq",
      contactEmail: sellerEmail,
      contactPhone: "+92 333 5551234",
      bankName: "Meezan Bank Limited",
      bankAccountTitle: `Indus Gear Co ${runId}`,
      bankIban: "PK44MEZN0012345678901234",
    }
  );
  assert(submittedApp.status === "SUBMITTED", "KYC onboarding application submitted for admin review");

  // Step 3: Platform Admin Reviews and Approves Application
  const reviewResult = await reviewSellerApplication(
    submittedApp.id,
    customerUser.id,
    "APPROVED",
    "Verified SECP registration and Meezan bank account title"
  );
  assert(reviewResult.status === "APPROVED", "Platform admin approved merchant application");

  const sellerContext = await getSellerContextForUser(sellerReg.user.id);
  assert(sellerContext?.sellerOrg?.operationalStatus === "ACTIVE", "Seller organization operationalStatus transitioned to ACTIVE");

  // Step 4: Seller Submits Product for Moderation
  const sellerSku = `INDUS-KNIFE-${runId}`;
  const sellerProd = await createSellerProduct(
    sellerReg.sellerOrg.id,
    {
      title: `Indus Bushcraft Hunting Knife ${runId}`,
      description: "Handcrafted Damascus steel hunting knife with walnut handle.",
      categoryId: cat.id,
      weightGrams: 400,
      variants: [
        {
          sku: sellerSku,
          title: "Standard Walnut",
          priceMinor: 850000, // PKR 8,500.00
          initialStock: 20,
          attributes: { handle: "Walnut" },
        },
      ],
      status: ProductStatus.DRAFT,
    },
    sellerReg.user.id
  );
  assert(sellerProd.status === ProductStatus.DRAFT, "Seller product initially created in DRAFT");

  // Step 5: Platform Admin Moderates & Approves Seller Product
  const moderatedProd = await approveProductModeration(
    sellerProd.id,
    customerUser.id,
    "Listing complies with marketplace quality standards"
  );
  assert(moderatedProd?.moderationStatus === ProductModerationStatus.APPROVED, "Admin approved seller product");
  assert(moderatedProd?.status === ProductStatus.PUBLISHED, "Product published to marketplace catalog");

  // Step 6: Customer Places Order for Seller's Product
  const sellerVariant = await prisma.productVariant.findFirst({ where: { productId: sellerProd.id } });
  assert(Boolean(sellerVariant), "Discovered seller product variant for checkout");
  const buyerCart = await getOrCreateCart(`buyer_session_${runId}`);
  await addItemToCart(buyerCart.id, sellerVariant!.id, 1);

  const marketplaceOrder = await placeOrder({
    cartId: buyerCart.id,
    customerEmail: `buyer_${runId}@example.com`,
    customerPhone: "+92 301 7778899",
    shippingAddress: {
      fullName: "Kamran Akmal",
      phone: "+92 301 7778899",
      street1: "Street 7, Sector I-8/2",
      city: "Islamabad",
      stateProvince: "Islamabad Capital Territory",
      postalCode: "44000",
      countryCode: "PK",
    },
    shippingTier: "STANDARD",
    idempotencyKey: `idemp_mkt_${runId}`,
    paymentMethod: "CASH_ON_DELIVERY",
  });

  const suborders = await getSellerOrders(sellerReg.sellerOrg.id);
  assert(suborders.total === 1, `Seller organization received suborder: ${suborders.orders[0].sellerOrderNumber}`);
  const merchantSuborder = suborders.orders[0];
  assert(merchantSuborder.status === SellerOrderStatus.CONFIRMED, "Suborder received in CONFIRMED status");

  // Step 7: Seller Fulfills Suborder with Courier Dispatch
  const sellerShipment = await createSellerShipment(
    sellerReg.sellerOrg.id,
    merchantSuborder.id,
    {
      carrierName: "LEOPARDS_COURIER",
      trackingNumber: `LEO-${runId}-9900`,
      trackingUrl: `https://leopardscourier.com/track/LEO-${runId}-9900`,
    },
    sellerReg.user.id
  );
  assert(sellerShipment.trackingNumber === `LEO-${runId}-9900`, "Seller fulfilled order with Leopards Courier tracking");

  // Step 8: Suborder Delivered and Settlement Escrow Released
  // Mark customer order as paid
  await prisma.customerOrder.update({
    where: { id: marketplaceOrder.id },
    data: { paymentStatus: "PAID" },
  });

  // Seller marks delivered
  await updateSellerOrderStatus(
    sellerReg.sellerOrg.id,
    merchantSuborder.id,
    SellerOrderStatus.DELIVERED,
    sellerReg.user.id
  );

  const updatedSuborder = await prisma.sellerOrder.findUnique({
    where: { id: merchantSuborder.id },
    include: { settlementLedgers: true },
  });
  assert(updatedSuborder!.status === SellerOrderStatus.DELIVERED, "Suborder marked as DELIVERED");

  const eligibleLedger = updatedSuborder!.settlementLedgers.find((l) => l.status === SettlementStatus.ELIGIBLE);
  assert(eligibleLedger !== undefined, "Settlement escrow transitioned to ELIGIBLE upon successful delivery & payment");

  // Archive ephemeral test product so public catalog stays clean
  if (sellerProd?.id) {
    await prisma.product.update({
      where: { id: sellerProd.id },
      data: { status: ProductStatus.ARCHIVED },
    });
  }

  // Clean up ephemeral 1P test product so catalog stays clean
  if (created1PProduct?.product?.id) {
    await prisma.inventoryAdjustment.deleteMany({ where: { variantId: created1PProduct.variant.id } });
    await prisma.inventoryLevel.deleteMany({ where: { variantId: created1PProduct.variant.id } });
    await prisma.productVariant.deleteMany({ where: { productId: created1PProduct.product.id } });
    await prisma.product.delete({ where: { id: created1PProduct.product.id } });
  }

  console.log("\n=========================================================");
  console.log(`🏁 AUDIT RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("=========================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

runE2EFunctionalAudit()
  .catch((err) => {
    console.error("Audit encountered an error:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
