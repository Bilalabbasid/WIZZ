import { prisma } from "@/lib/db";
import {
  SellerApplicationStatus,
  SellerOperationalStatus,
  SellerMembershipRole,
  UserRole,
} from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getCommerceSettings } from "@/lib/commerce-settings";

export interface SellerApplicationInput {
  legalBusinessName: string;
  tradingName: string;
  businessRegNumber?: string | null;
  taxVatNumber?: string | null;
  countryCode: string;
  city: string;
  addressLine: string;
  websiteUrl?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  bankName?: string | null;
  bankAccountTitle?: string | null;
  bankIban?: string | null;
  notes?: string | null;
}

/**
 * The only application fields an applicant may write. Status, reviewer feedback,
 * approvedOrgId and timestamps are owned by the server and the review workflow, so
 * the request body is never spread into Prisma.
 */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : v ?? null),
    z.string().max(max).nullable()
  );

const applicationDraftSchema = z.object({
  legalBusinessName: optionalText(200),
  tradingName: optionalText(120),
  businessRegNumber: optionalText(60),
  taxVatNumber: optionalText(60),
  city: optionalText(80),
  addressLine: optionalText(300),
  websiteUrl: optionalText(300).refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), "Website must start with http:// or https://"),
  contactName: optionalText(120),
  contactEmail: optionalText(200).refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid contact email address."),
  contactPhone: optionalText(30),
  bankName: optionalText(120),
  bankAccountTitle: optionalText(160),
  bankIban: optionalText(34).refine((v) => !v || /^[A-Za-z0-9 ]{10,34}$/.test(v), "IBAN may contain only letters and digits (10-34 characters)."),
  notes: optionalText(2000),
});

const REQUIRED_FOR_SUBMIT: Array<[keyof z.infer<typeof applicationDraftSchema>, string]> = [
  ["legalBusinessName", "Legal business name"],
  ["tradingName", "Trading store name"],
  ["contactName", "Primary contact person"],
  ["contactEmail", "Business email"],
  ["contactPhone", "Phone number"],
  ["addressLine", "Warehouse / pickup address"],
  ["city", "City"],
  ["bankName", "Bank name"],
  ["bankAccountTitle", "Bank account title"],
  ["bankIban", "IBAN"],
];

function parseApplicationFields(data: unknown, requireComplete: boolean) {
  const parsed = applicationDraftSchema.safeParse(data ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(" "));
  }
  const fields = parsed.data;
  if (requireComplete) {
    const missing = REQUIRED_FOR_SUBMIT.filter(([key]) => !fields[key]).map(([, label]) => label);
    if (missing.length) throw new Error(`Please complete: ${missing.join(", ")}.`);
  }
  return {
    legalBusinessName: fields.legalBusinessName ?? "",
    tradingName: fields.tradingName ?? "",
    businessRegNumber: fields.businessRegNumber,
    taxVatNumber: fields.taxVatNumber,
    countryCode: "PK",
    city: fields.city ?? "",
    addressLine: fields.addressLine ?? "",
    websiteUrl: fields.websiteUrl,
    contactName: fields.contactName ?? "",
    contactEmail: (fields.contactEmail ?? "").toLowerCase(),
    contactPhone: fields.contactPhone ?? "",
    bankName: fields.bankName,
    bankAccountTitle: fields.bankAccountTitle,
    bankIban: fields.bankIban ? fields.bankIban.replace(/\s+/g, "").toUpperCase() : null,
    notes: fields.notes,
  };
}

export interface SellerRegistrationInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tradingName: string;
  legalBusinessName?: string;
  city?: string;
  addressLine?: string;
}

/**
 * Registers a new seller: creates user, provisions inactive SellerOrg,
 * assigns OWNER role, and initializes a DRAFT SellerApplication.
 */
export async function registerSellerAccount(input: SellerRegistrationInput) {
  const cleanEmail = input.email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (existingUser) {
    throw new Error("An account with this email address already exists.");
  }

  const passwordHash = await hashPassword(input.password);
  const tradingName = input.tradingName.trim();
  const slug = tradingName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const uniqueSlug = `${slug || "seller"}-${Date.now().toString().slice(-4)}`;

  return prisma.$transaction(async (tx) => {
    // 1. Create User
    const user = await tx.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        role: UserRole.CUSTOMER,
        isEmailVerified: true,
      },
    });

    // 2. Provision inactive SellerOrg
    const sellerOrg = await tx.sellerOrg.create({
      data: {
        name: tradingName,
        slug: uniqueSlug,
        legalName: input.legalBusinessName?.trim() || tradingName,
        contactEmail: cleanEmail,
        contactPhone: input.phone?.trim() || null,
        city: input.city?.trim() || null,
        addressLine: input.addressLine?.trim() || null,
        operationalStatus: SellerOperationalStatus.INACTIVE,
        commissionRatePercent: (await getCommerceSettings()).defaultCommissionPercent,
      },
    });

    // 3. Assign OWNER membership
    const membership = await tx.sellerMembership.create({
      data: {
        sellerOrgId: sellerOrg.id,
        userId: user.id,
        role: SellerMembershipRole.OWNER,
        isActive: true,
      },
    });

    // 4. Initialize DRAFT application
    const application = await tx.sellerApplication.create({
      data: {
        applicantUserId: user.id,
        legalBusinessName: input.legalBusinessName?.trim() || tradingName,
        tradingName,
        countryCode: "PK",
        city: input.city?.trim() || "Karachi",
        addressLine: input.addressLine?.trim() || "Warehouse Address Pending",
        contactName: `${input.firstName.trim()} ${input.lastName.trim()}`,
        contactEmail: cleanEmail,
        contactPhone: input.phone?.trim() || "",
        status: SellerApplicationStatus.DRAFT,
        approvedOrgId: sellerOrg.id,
      },
    });

    // 5. Initial audit / application event
    await tx.applicationEvent.create({
      data: {
        applicationId: application.id,
        actorUserId: user.id,
        fromStatus: null,
        toStatus: SellerApplicationStatus.DRAFT,
        note: "Seller account registered and initial onboarding workspace provisioned.",
      },
    });

    return { user, sellerOrg, membership, application };
  });
}

/**
 * Retrieves the seller context for a given user: membership, org, application, and permissions.
 */
export async function getSellerContextForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { isActive: true },
        include: { sellerOrg: true },
        orderBy: { createdAt: "desc" },
      },
      applications: {
        include: {
          events: { orderBy: { createdAt: "desc" } },
          documents: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) return null;

  const membership = user.memberships[0] || null;
  const sellerOrg = membership?.sellerOrg || null;
  const application = user.applications[0] || null;

  const isApproved = application?.status === SellerApplicationStatus.APPROVED;
  const isActiveOrg = sellerOrg?.operationalStatus === SellerOperationalStatus.ACTIVE;
  const isSuspended = sellerOrg?.operationalStatus === SellerOperationalStatus.SUSPENDED;

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    membership,
    sellerOrg,
    application,
    // The organization's operational status is authoritative: invited team members and
    // the first-party store have no KYC application of their own.
    status: isSuspended
      ? "SUSPENDED"
      : isActiveOrg
      ? SellerApplicationStatus.APPROVED
      : application?.status || "NO_APPLICATION",
    canSell: isActiveOrg,
    isApplicantApproved: isApproved,
    suspensionReason: sellerOrg?.suspensionReason || null,
  };
}

export async function getSellerApplicationByUserId(userId: string) {
  return prisma.sellerApplication.findFirst({
    where: { applicantUserId: userId },
    include: {
      events: { orderBy: { createdAt: "desc" } },
      documents: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSellerApplicationById(applicationId: string) {
  return prisma.sellerApplication.findUnique({
    where: { id: applicationId },
    include: {
      applicantUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      events: { orderBy: { createdAt: "desc" } },
      documents: true,
    },
  });
}

export async function saveApplicationDraft(userId: string, data: unknown) {
  const fields = parseApplicationFields(data, false);
  const existing = await prisma.sellerApplication.findFirst({
    where: {
      applicantUserId: userId,
      status: { in: [SellerApplicationStatus.DRAFT, SellerApplicationStatus.CHANGES_REQUESTED] },
    },
  });

  if (existing) {
    return prisma.sellerApplication.update({ where: { id: existing.id }, data: fields });
  }

  await assertNoOpenApplication(userId);
  return prisma.sellerApplication.create({
    data: { applicantUserId: userId, ...fields, status: SellerApplicationStatus.DRAFT },
  });
}

/** An applicant cannot start a second application while one is under review or decided. */
async function assertNoOpenApplication(userId: string) {
  const other = await prisma.sellerApplication.findFirst({
    where: { applicantUserId: userId },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  if (other && other.status !== SellerApplicationStatus.REJECTED) {
    const label = other.status === SellerApplicationStatus.SUBMITTED ? "is already under review" : `is ${other.status.toLowerCase().replace(/_/g, " ")}`;
    throw new Error(`Your seller application ${label}, so it cannot be edited right now.`);
  }
}

export async function submitSellerApplication(userId: string, data: unknown) {
  const fields = parseApplicationFields(data, true);
  const existing = await prisma.sellerApplication.findFirst({
    where: {
      applicantUserId: userId,
      status: { in: [SellerApplicationStatus.DRAFT, SellerApplicationStatus.CHANGES_REQUESTED] },
    },
  });

  const fromStatus = existing?.status || SellerApplicationStatus.DRAFT;

  if (existing) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.sellerApplication.update({
        where: { id: existing.id },
        data: {
          ...fields,
          status: SellerApplicationStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });

      await tx.applicationEvent.create({
        data: {
          applicationId: existing.id,
          actorUserId: userId,
          fromStatus,
          toStatus: SellerApplicationStatus.SUBMITTED,
          note: "Applicant submitted completed application for evaluation.",
        },
      });

      return updated;
    });
  }

  await assertNoOpenApplication(userId);
  return prisma.$transaction(async (tx) => {
    const created = await tx.sellerApplication.create({
      data: {
        applicantUserId: userId,
        ...fields,
        status: SellerApplicationStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    await tx.applicationEvent.create({
      data: {
        applicationId: created.id,
        actorUserId: userId,
        fromStatus: SellerApplicationStatus.DRAFT,
        toStatus: SellerApplicationStatus.SUBMITTED,
        note: "Applicant created and submitted new seller application.",
      },
    });

    return created;
  });
}

export async function getAllSellerApplications(statusFilter?: SellerApplicationStatus) {
  const where = statusFilter ? { status: statusFilter } : {};
  return prisma.sellerApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      applicantUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      documents: true,
      events: { take: 3, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function reviewSellerApplication(
  applicationId: string,
  reviewerUserId: string,
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
  feedbackNote?: string
) {
  const application = await prisma.sellerApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error("Application not found.");
  }

  // Decisions are made only on submitted applications (drafts still hold placeholder data)
  if (application.status !== SellerApplicationStatus.SUBMITTED) {
    throw new Error(
      `VALIDATION: This application is ${application.status.toLowerCase().replace(/_/g, " ")}. Only submitted applications can be reviewed.`
    );
  }
  if (decision !== "APPROVED" && (!feedbackNote || feedbackNote.trim().length < 3)) {
    throw new Error("VALIDATION: Add a note explaining the decision to the applicant.");
  }

  // The store being activated must be one the applicant already owns
  if (application.approvedOrgId) {
    const ownMembership = await prisma.sellerMembership.findFirst({
      where: {
        sellerOrgId: application.approvedOrgId,
        userId: application.applicantUserId,
        role: SellerMembershipRole.OWNER,
      },
      select: { id: true },
    });
    if (!ownMembership) {
      throw new Error("FORBIDDEN: This application is linked to a store the applicant does not own. Reject it and investigate.");
    }
  }

  const fromStatus = application.status;
  const toStatus =
    decision === "APPROVED"
      ? SellerApplicationStatus.APPROVED
      : decision === "REJECTED"
      ? SellerApplicationStatus.REJECTED
      : SellerApplicationStatus.CHANGES_REQUESTED;

  return prisma.$transaction(async (tx) => {
    let approvedOrgId = application.approvedOrgId;

    if (decision === "APPROVED") {
      if (approvedOrgId) {
        // Activate existing provisioned SellerOrg
        await tx.sellerOrg.update({
          where: { id: approvedOrgId },
          data: {
            operationalStatus: SellerOperationalStatus.ACTIVE,
            legalName: application.legalBusinessName,
            taxId: application.taxVatNumber,
            contactEmail: application.contactEmail,
            contactPhone: application.contactPhone,
            bankName: application.bankName,
            bankAccountTitle: application.bankAccountTitle,
            bankIban: application.bankIban,
            city: application.city,
            addressLine: application.addressLine,
          },
        });

        // Ensure membership exists
        const existingMembership = await tx.sellerMembership.findUnique({
          where: {
            sellerOrgId_userId: {
              sellerOrgId: approvedOrgId,
              userId: application.applicantUserId,
            },
          },
        });

        if (!existingMembership) {
          await tx.sellerMembership.create({
            data: {
              sellerOrgId: approvedOrgId,
              userId: application.applicantUserId,
              role: SellerMembershipRole.OWNER,
            },
          });
        }
      } else {
        // 1. Create new SellerOrg
        const slug = application.tradingName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        const uniqueSlug = `${slug}-${Date.now().toString().slice(-4)}`;

        const sellerOrg = await tx.sellerOrg.create({
          data: {
            name: application.tradingName,
            slug: uniqueSlug,
            legalName: application.legalBusinessName,
            taxId: application.taxVatNumber,
            operationalStatus: SellerOperationalStatus.ACTIVE,
            contactEmail: application.contactEmail,
            contactPhone: application.contactPhone,
            bankName: application.bankName,
            bankAccountTitle: application.bankAccountTitle,
            bankIban: application.bankIban,
            city: application.city,
            addressLine: application.addressLine,
            commissionRatePercent: (await getCommerceSettings()).defaultCommissionPercent,
          },
        });

        approvedOrgId = sellerOrg.id;

        // 2. Grant Owner membership to applicant
        await tx.sellerMembership.create({
          data: {
            sellerOrgId: sellerOrg.id,
            userId: application.applicantUserId,
            role: SellerMembershipRole.OWNER,
          },
        });
      }

      // Notify seller
      await tx.notification.create({
        data: {
          userId: application.applicantUserId,
          sellerOrgId: approvedOrgId,
          title: "Seller Application Approved!",
          message: "Congratulations! Your merchant organization is now ACTIVE on WIZZ.PK. You can now publish products and fulfill orders.",
          type: "APPLICATION",
          linkUrl: "/seller/portal",
        },
      });
    } else if (decision === "CHANGES_REQUESTED") {
      await tx.notification.create({
        data: {
          userId: application.applicantUserId,
          sellerOrgId: application.approvedOrgId,
          title: "Application Changes Requested",
          message: feedbackNote || "Platform administration requested adjustments to your application. Please review and resubmit.",
          type: "APPLICATION",
          linkUrl: "/seller/onboarding",
        },
      });
    } else if (decision === "REJECTED") {
      await tx.notification.create({
        data: {
          userId: application.applicantUserId,
          sellerOrgId: application.approvedOrgId,
          title: "Seller Application Rejected",
          message: feedbackNote || "Your seller application could not be approved at this time. Please contact support for assistance.",
          type: "APPLICATION",
          linkUrl: "/seller/onboarding",
        },
      });
    }

    const updatedApp = await tx.sellerApplication.update({
      where: { id: applicationId },
      data: {
        status: toStatus,
        reviewerFeedback: feedbackNote || null,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        approvedOrgId,
      },
    });

    await tx.applicationEvent.create({
      data: {
        applicationId,
        actorUserId: reviewerUserId,
        fromStatus,
        toStatus,
        note: feedbackNote || `Application marked ${toStatus} by platform administration.`,
      },
    });

    // Audit log
    await tx.auditEvent.create({
      data: {
        actorUserId: reviewerUserId,
        entityType: "SellerApplication",
        entityId: applicationId,
        action: `APPLICATION_${decision}`,
        detailsJson: JSON.stringify({ decision, feedbackNote, approvedOrgId }),
      },
    });

    return updatedApp;
  });
}

/**
 * Admin action: suspend an active seller organization.
 */
export async function suspendSellerOrg(
  sellerOrgId: string,
  adminUserId: string,
  reason: string
) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.sellerOrg.update({
      where: { id: sellerOrgId },
      data: {
        operationalStatus: SellerOperationalStatus.SUSPENDED,
        suspensionReason: reason,
      },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: adminUserId,
        entityType: "SellerOrg",
        entityId: sellerOrgId,
        action: "SELLER_SUSPENDED",
        detailsJson: JSON.stringify({ reason }),
      },
    });

    // Notify all active members
    const members = await tx.sellerMembership.findMany({
      where: { sellerOrgId, isActive: true },
      select: { userId: true },
    });

    for (const m of members) {
      await tx.notification.create({
        data: {
          userId: m.userId,
          sellerOrgId,
          title: "Seller Organization Suspended",
          message: `Your seller account has been temporarily suspended: "${reason}". Please contact platform compliance support.`,
          type: "APPLICATION",
          linkUrl: "/seller/portal",
        },
      });
    }

    return org;
  });
}

/**
 * Admin action: reactivate a suspended seller organization.
 */
export async function reactivateSellerOrg(sellerOrgId: string, adminUserId: string) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.sellerOrg.update({
      where: { id: sellerOrgId },
      data: {
        operationalStatus: SellerOperationalStatus.ACTIVE,
        suspensionReason: null,
      },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: adminUserId,
        entityType: "SellerOrg",
        entityId: sellerOrgId,
        action: "SELLER_REACTIVATED",
        detailsJson: JSON.stringify({ action: "Reactivation" }),
      },
    });

    const members = await tx.sellerMembership.findMany({
      where: { sellerOrgId, isActive: true },
      select: { userId: true },
    });

    for (const m of members) {
      await tx.notification.create({
        data: {
          userId: m.userId,
          sellerOrgId,
          title: "Seller Account Reactivated",
          message: "Your seller organization has been restored to ACTIVE status.",
          type: "APPLICATION",
          linkUrl: "/seller/portal",
        },
      });
    }

    return org;
  });
}

/**
 * Updates a seller organization's store profile, address, and settlement bank details.
 */
export async function updateSellerOrgProfile(
  sellerOrgId: string,
  data: {
    name?: string;
    logoUrl?: string;
    bannerUrl?: string;
    contactEmail?: string;
    contactPhone?: string;
    city?: string;
    addressLine?: string;
    bankName?: string;
    bankAccountTitle?: string;
    bankIban?: string;
  },
  actorUserId?: string
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.sellerOrg.update({
      where: { id: sellerOrgId },
      data,
    });

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "SellerOrg",
          entityId: sellerOrgId,
          action: "PROFILE_UPDATE",
          detailsJson: JSON.stringify(data),
        },
      });
    }

    return updated;
  });
}

/**
 * Aggregates live dashboard metrics for a seller organization.
 */
export async function getSellerDashboardStats(sellerOrgId: string) {
  const [orders, products, allLevels] = await Promise.all([
    prisma.sellerOrder.findMany({
      where: { sellerOrgId },
      orderBy: { createdAt: "desc" },
      include: {
        customerOrder: {
          select: {
            orderNumber: true,
            customerEmail: true,
            status: true,
            paymentStatus: true,
          },
        },
        items: true,
      },
    }),
    prisma.product.findMany({
      where: { sellerOrgId },
      select: { id: true, status: true },
    }),
    prisma.inventoryLevel.findMany({
      where: { sellerOrgId, variant: { isActive: true, product: { status: { not: "ARCHIVED" } } } },
      include: {
        variant: {
          select: { title: true, sku: true, product: { select: { title: true } } },
        },
      },
    }),
  ]);
  // Each variant has its own threshold; compare against sellable units (available minus held)
  const lowStockLevels = allLevels
    .filter((l) => l.availableUnits - l.reservedUnits <= l.lowStockThreshold)
    .sort((a, b) => a.availableUnits - b.availableUnits);

  let totalGmvMinor = 0;
  let totalNetPayableMinor = 0;
  let pendingOrdersCount = 0;

  for (const o of orders) {
    // Unpaid online orders and cancelled packages are not sales
    if (o.status !== "CANCELLED" && o.status !== "PENDING_PAYMENT") {
      totalGmvMinor += o.totalMinor;
      totalNetPayableMinor += o.netSellerPayableMinor;
    }
    if (o.status === "CONFIRMED" || o.status === "PACKING") {
      pendingOrdersCount++;
    }
  }

  return {
    totalGmvMinor,
    totalNetPayableMinor,
    ordersCount: orders.length,
    pendingOrdersCount,
    productsCount: products.length,
    publishedProductsCount: products.filter((p) => p.status === "PUBLISHED").length,
    lowStockCount: lowStockLevels.length,
    lowStockAlerts: lowStockLevels.slice(0, 5).map((lvl) => ({
      variantId: lvl.variantId,
      productTitle: lvl.variant.product.title,
      variantTitle: lvl.variant.title,
      sku: lvl.variant.sku,
      availableUnits: lvl.availableUnits - lvl.reservedUnits,
      lowStockThreshold: lvl.lowStockThreshold,
    })),
    recentOrders: orders.slice(0, 5).map((o) => ({
      id: o.id,
      sellerOrderNumber: o.sellerOrderNumber,
      orderNumber: o.customerOrder.orderNumber,
      status: o.status,
      totalMinor: o.totalMinor,
      netSellerPayableMinor: o.netSellerPayableMinor,
      itemCount: o.items.reduce((acc, i) => acc + i.quantity, 0),
      createdAt: o.createdAt,
    })),
  };
}

/**
 * Team Management: retrieves members and pending invitations for a seller org.
 */
export async function getSellerTeamMembers(sellerOrgId: string) {
  const [members, invitations] = await Promise.all([
    prisma.sellerMembership.findMany({
      where: { sellerOrgId, isActive: true },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sellerInvitation.findMany({
      where: { sellerOrgId, status: "PENDING", expiresAt: { gt: new Date() } },
      include: {
        invitedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { members, invitations };
}

/**
 * Invites a new team member to a seller org.
 */
export async function inviteSellerTeamMember(
  sellerOrgId: string,
  invitedByUserId: string,
  email: string,
  role: SellerMembershipRole = SellerMembershipRole.ADMIN
) {
  const cleanEmail = email.toLowerCase().trim();

  // Check if already an active member
  const existingMember = await prisma.sellerMembership.findFirst({
    where: {
      sellerOrgId,
      user: { email: cleanEmail },
      isActive: true,
    },
  });

  if (existingMember) {
    throw new Error("This user is already an active member of this organization.");
  }

  if (!z.string().email().safeParse(cleanEmail).success) {
    throw new Error("VALIDATION: Enter a valid email address.");
  }
  if (!Object.values(SellerMembershipRole).includes(role)) {
    throw new Error("VALIDATION: Choose a valid team role.");
  }

  // Replace any earlier pending invite for the same email
  await prisma.sellerInvitation.updateMany({
    where: { sellerOrgId, email: cleanEmail, status: "PENDING" },
    data: { status: "REVOKED" },
  });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return prisma.sellerInvitation.create({
    data: {
      sellerOrgId,
      email: cleanEmail,
      role,
      token,
      invitedById: invitedByUserId,
      expiresAt,
    },
  });
}

/** Looks up a pending, unexpired invitation for the accept page. */
export async function getSellerInvitation(token: string) {
  if (!token || token.length < 20) return null;
  const inv = await prisma.sellerInvitation.findUnique({
    where: { token },
    include: { sellerOrg: { select: { name: true, operationalStatus: true } } },
  });
  if (!inv || inv.status !== "PENDING" || inv.expiresAt < new Date()) return null;
  return inv;
}

/**
 * Signed-in user accepts a team invitation. The account email must match the invited
 * email, so a leaked link cannot be used by someone else.
 */
export async function acceptSellerInvitation(token: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.sellerInvitation.findUnique({ where: { token } });
    if (!inv || inv.status !== "PENDING" || inv.expiresAt < new Date()) {
      throw new Error("VALIDATION: This invitation is invalid or has expired. Ask the store owner for a new one.");
    }
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user || user.email.toLowerCase() !== inv.email.toLowerCase()) {
      throw new Error(`FORBIDDEN: This invitation was sent to ${inv.email}. Sign in with that email to accept it.`);
    }
    const otherStore = await tx.sellerMembership.findFirst({
      where: { userId, isActive: true, sellerOrgId: { not: inv.sellerOrgId } },
      select: { id: true },
    });
    if (otherStore) {
      throw new Error("VALIDATION: Your account already belongs to another store. Use a different email for this team.");
    }

    const flipped = await tx.sellerInvitation.updateMany({
      where: { id: inv.id, status: "PENDING" },
      data: { status: "ACCEPTED" },
    });
    if (flipped.count === 0) throw new Error("VALIDATION: This invitation was already used.");

    const membership = await tx.sellerMembership.upsert({
      where: { sellerOrgId_userId: { sellerOrgId: inv.sellerOrgId, userId } },
      create: { sellerOrgId: inv.sellerOrgId, userId, role: inv.role },
      update: { isActive: true, role: inv.role },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: userId,
        entityType: "SellerOrg",
        entityId: inv.sellerOrgId,
        action: "TEAM_INVITE_ACCEPTED",
        detailsJson: JSON.stringify({ invitationId: inv.id, role: inv.role }),
      },
    });
    return membership;
  });
}

/** Revokes a pending invitation of this seller org. */
export async function revokeSellerInvitation(sellerOrgId: string, invitationId: string) {
  const res = await prisma.sellerInvitation.updateMany({
    where: { id: invitationId, sellerOrgId, status: "PENDING" },
    data: { status: "REVOKED" },
  });
  if (res.count === 0) throw new Error("Invitation not found.");
}

/**
 * Removes a team member from a seller organization.
 */
export async function removeSellerTeamMember(
  sellerOrgId: string,
  membershipId: string,
  actorRole?: SellerMembershipRole | "PLATFORM_SUPER_ADMIN"
) {
  const target = await prisma.sellerMembership.findUnique({
    where: { id: membershipId },
  });

  if (!target || target.sellerOrgId !== sellerOrgId || !target.isActive) {
    throw new Error("Membership not found in this organization.");
  }

  if (target.role === SellerMembershipRole.OWNER) {
    if (actorRole && actorRole !== SellerMembershipRole.OWNER && actorRole !== "PLATFORM_SUPER_ADMIN") {
      throw new Error("FORBIDDEN: Only an Owner or Platform Super Admin can remove an organization Owner.");
    }

    const ownerCount = await prisma.sellerMembership.count({
      where: { sellerOrgId, role: SellerMembershipRole.OWNER, isActive: true },
    });
    if (ownerCount <= 1) {
      throw new Error("Cannot remove the sole OWNER of the organization.");
    }
  }

  return prisma.sellerMembership.update({
    where: { id: membershipId },
    data: { isActive: false },
  });
}

/**
 * Audit history: retrieves logged events for a seller org.
 */
export async function getSellerAuditHistory(sellerOrgId: string, limit: number = 30) {
  return prisma.auditEvent.findMany({
    where: {
      OR: [
        { entityType: "SellerOrg", entityId: sellerOrgId },
        { entityType: "SellerOrder", detailsJson: { contains: sellerOrgId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actorUser: { select: { firstName: true, lastName: true, email: true } },
    },
  });
}

/**
 * Notifications: fetches notifications for a user/sellerOrg.
 */
export async function getSellerNotifications(userId: string, sellerOrgId?: string) {
  return prisma.notification.findMany({
    where: sellerOrgId ? { userId, OR: [{ sellerOrgId }, { sellerOrgId: null }] } : { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** Marks one notification (or all when `notificationId` is null) as read, only the caller's own. */
export async function markNotificationRead(notificationId: string | null, userId: string) {
  return prisma.notification.updateMany({
    where: notificationId ? { id: notificationId, userId } : { userId, isRead: false },
    data: { isRead: true },
  });
}
