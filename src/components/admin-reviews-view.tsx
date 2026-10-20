"use client";

import { useState } from "react";
import {
  Star,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Clock,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface ReviewItem {
  id: string;
  productId: string;
  rating: number;
  title: string | null;
  comment: string;
  isVerifiedPurchase: boolean;
  isModerated: boolean;
  isApproved: boolean;
  createdAt: string | Date;
  product: {
    id: string;
    title: string;
    slug: string;
  };
  customerUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export function AdminReviewsView({ initialReviews }: { initialReviews: ReviewItem[] }) {
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const filteredReviews = reviews.filter((r) => {
    if (filter === "pending") return !r.isModerated;
    if (filter === "approved") return r.isModerated && r.isApproved;
    if (filter === "rejected") return r.isModerated && !r.isApproved;
    return true;
  });

  const handleModeration = async (reviewId: string, approve: boolean) => {
    setLoadingId(reviewId);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, isApproved: approve }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Action failed");
      }

      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, isModerated: true, isApproved: approve } : r
        )
      );

      setToast({
        message: `Review #${reviewId.slice(-6)} ${approve ? "approved" : "rejected"}.`,
        type: "success",
      });
      setTimeout(() => setToast(null), 3500);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to update review", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between border ${
            toast.type === "success"
              ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/80 border-rose-500/40 text-rose-200"
          }`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="text-xs uppercase tracking-wider font-bold opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "all", label: `All Reviews (${reviews.length})` },
            {
              key: "pending",
              label: `Pending Review (${reviews.filter((r) => !r.isModerated).length})`,
            },
            {
              key: "approved",
              label: `Approved (${reviews.filter((r) => r.isModerated && r.isApproved).length})`,
            },
            {
              key: "rejected",
              label: `Rejected (${reviews.filter((r) => r.isModerated && !r.isApproved).length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              filter === tab.key
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Review List */}
      {filteredReviews.length === 0 ? (
        <div className="text-center py-16 bg-slate-950/60 rounded-2xl border border-slate-800">
          <AlertCircle className="mx-auto text-slate-500 mb-3" size={32} />
          <h3 className="text-base font-semibold text-slate-200">No reviews found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {filter === "pending"
              ? "All submitted reviews have been moderated."
              : "There are no reviews matching this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredReviews.map((review) => {
            const isLoading = loadingId === review.id;
            const createdAtFormatted = new Date(review.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={review.id}
                className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 transition hover:border-slate-700 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Rating stars */}
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={16}
                          className={
                            star <= review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-600"
                          }
                        />
                      ))}
                    </div>
                    {review.title && (
                      <h4 className="font-bold text-white text-sm">{review.title}</h4>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {review.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                        <ShieldCheck size={12} />
                        Verified Purchase
                      </span>
                    )}

                    {!review.isModerated ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/60">
                        <Clock size={12} />
                        Pending Moderation
                      </span>
                    ) : review.isApproved ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                        <CheckCircle size={12} />
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-950/60 text-rose-400 border border-rose-800/60">
                        <XCircle size={12} />
                        Rejected
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {review.comment}
                </p>

                <div className="pt-3 border-t border-slate-900 flex flex-col md:flex-row md:items-center justify-between text-xs text-slate-400 gap-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <span>
                      Customer:{" "}
                      <strong className="text-slate-200">
                        {review.customerUser.firstName} {review.customerUser.lastName}
                      </strong>{" "}
                      ({review.customerUser.email})
                    </span>
                    <span>
                      Product:{" "}
                      <Link
                        href={`/products/${review.product.slug}`}
                        target="_blank"
                        className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                      >
                        {review.product.title}
                        <ExternalLink size={12} />
                      </Link>
                    </span>
                    <span>Date: {createdAtFormatted}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleModeration(review.id, true)}
                      disabled={isLoading || (review.isModerated && review.isApproved)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        review.isModerated && review.isApproved
                          ? "bg-slate-800/50 text-slate-500 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      <CheckCircle size={14} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleModeration(review.id, false)}
                      disabled={isLoading || (review.isModerated && !review.isApproved)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        review.isModerated && !review.isApproved
                          ? "bg-slate-800/50 text-slate-500 cursor-not-allowed"
                          : "bg-rose-600 hover:bg-rose-500 text-white"
                      }`}
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
