import { getCurrentUser, requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllReviewsForAdmin } from "@/modules/reviews/services";
import { AdminReviewsView } from "@/components/admin-reviews-view";
import { Star } from "lucide-react";

export default async function AdminReviewsPage() {
  try {
    await requireRole([
      "PLATFORM_SUPER_ADMIN",
      "PLATFORM_CATALOG_ADMIN",
      "PLATFORM_SUPPORT",
    ]);
  } catch {
    redirect("/login?next=/admin/reviews");
  }


  const reviews = await getAllReviewsForAdmin();

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Star size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Customer Reviews & Moderation
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Review and moderate feedback from verified shoppers and customer accounts across all 1P catalog items.
            </p>
          </div>
        </div>
      </div>

      <AdminReviewsView initialReviews={reviews} />
    </div>
  );
}
