import { prisma } from "@/lib/db";
import { isReviewsModerationActive } from "@/lib/flags";

export async function submitProductReview(
  customerUserId: string,
  productId: string,
  rating: number,
  comment: string,
  title?: string
) {
  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  if (!comment || comment.trim().length < 5) {
    throw new Error("Review comment must be at least 5 characters.");
  }

  // Check verified purchase: did user order this product?
  const pastOrderItem = await prisma.orderItem.findFirst({
    where: {
      variant: { productId },
      sellerOrder: {
        customerOrder: {
          customerUserId,
          paymentStatus: "PAID",
        },
      },
    },
  });

  const isVerifiedPurchase = Boolean(pastOrderItem);
  const requiresModeration = isReviewsModerationActive();

  return prisma.review.create({
    data: {
      productId,
      customerUserId,
      orderItemId: pastOrderItem?.id || null,
      rating,
      title: title || null,
      comment: comment.trim(),
      isVerifiedPurchase,
      isModerated: !requiresModeration,
      isApproved: !requiresModeration, // Auto-approve if moderation flag off, otherwise holds for moderation
    },
  });
}

export async function getProductReviews(productId: string) {
  return prisma.review.findMany({
    where: {
      productId,
      isApproved: true,
    },
    orderBy: { createdAt: "desc" },
    include: {
      customerUser: {
        select: { firstName: true, lastName: true },
      },
    },
  });
}

export async function moderateReview(reviewId: string, isApproved: boolean) {
  return prisma.review.update({
    where: { id: reviewId },
    data: {
      isApproved,
      isModerated: true,
    },
  });
}

export async function getAllReviewsForAdmin() {
  return prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: { id: true, title: true, slug: true },
      },
      customerUser: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });
}

