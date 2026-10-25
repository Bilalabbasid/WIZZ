import { prisma } from "@/lib/db";
import {
  SellerApplicationStatus,
  SellerOperationalStatus,
  SellerMembershipRole,
  UserRole,
} from "@prisma/client";
import { hashPassword } from "@/lib/auth";

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
        commissionRatePercent: 10,
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

export async function saveApplicationDraft(userId: string, data: Partial<SellerApplicationInput>) {
  const existing = await prisma.sellerApplication.findFirst({
    where: {
      applicantUserId: userId,
      status: { in: [SellerApplicationStatus.DRAFT, SellerApplicationStatus.CHANGES_REQUESTED] },
    },
  });

  if (existing) {
    return prisma.sellerApplication.update({
      where: { id: existing.id },
      data: {
        ...data,
      },
    });
  }

  return prisma.sellerApplication.create({
    data: {
      applicantUserId: userId,
      legalBusinessName: data.legalBusinessName || "",
      tradingName: data.tradingName || "",
      businessRegNumber: data.businessRegNumber || null,
      taxVatNumber: data.taxVatNumber || null,
      countryCode: data.countryCode || "PK",
      city: data.city || "",
      addressLine: data.addressLine || "",
      websiteUrl: data.websiteUrl || null,
      contactName: data.contactName || "",
      contactEmail: data.contactEmail || "",
      contactPhone: data.contactPhone || "",
      bankName: data.bankName || null,
      bankAccountTitle: data.bankAccountTitle || null,
      bankIban: data.bankIban || null,
      notes: data.notes || null,
      status: SellerApplicationStatus.DRAFT,
    },
  });
}

export async function submitSellerApplication(userId: string, data: SellerApplicationInput) {
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
          ...data,
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

  return prisma.$transaction(async (tx) => {
    const created = await tx.sellerApplication.create({
      data: {
        applicantUserId: userId,
        ...data,
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
            commissionRatePercent: 10,
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
  const [orders, products, lowStockLevels] = await Promise.all([
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
      where: {
        sellerOrgId,
        availableUnits: { lte: 5 },
      },
      include: {
        variant: {
          select: { title: true, sku: true, product: { select: { title: true } } },
        },
      },
    }),
  ]);

  let totalGmvMinor = 0;
  let totalNetPayableMinor = 0;
  let pendingOrdersCount = 0;

  for (const o of orders) {
    if (o.status !== "CANCELLED") {
      totalGmvMinor += o.totalMinor;
      totalNetPayableMinor += o.netSellerPayableMinor;
    }
    if (o.status === "CONFIRMED" || o.status === "PACKING" || o.status === "PENDING_PAYMENT") {
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
      availableUnits: lvl.availableUnits,
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
      where: { sellerOrgId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sellerInvitation.findMany({
      where: { sellerOrgId, status: "PENDING" },
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

  const token = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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

  if (!target || target.sellerOrgId !== sellerOrgId) {
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
    where: {
      OR: [
        { userId },
        ...(sellerOrgId ? [{ sellerOrgId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}
