import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSellerApplicationByUserId } from "@/modules/sellers/services";
import { SellerOnboardingWorkspace } from "@/components/seller-onboarding-workspace";
import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";

export default async function SellerOnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/seller/onboarding");
  }

  const rawApplication = await getSellerApplicationByUserId(user.id);

  const initialApplication = rawApplication
    ? {
        id: rawApplication.id,
        legalBusinessName: rawApplication.legalBusinessName,
        tradingName: rawApplication.tradingName,
        businessRegNumber: rawApplication.businessRegNumber,
        taxVatNumber: rawApplication.taxVatNumber,
        countryCode: rawApplication.countryCode,
        city: rawApplication.city,
        addressLine: rawApplication.addressLine,
        websiteUrl: rawApplication.websiteUrl,
        contactName: rawApplication.contactName,
        contactEmail: rawApplication.contactEmail,
        contactPhone: rawApplication.contactPhone,
        bankName: rawApplication.bankName,
        bankAccountTitle: rawApplication.bankAccountTitle,
        bankIban: rawApplication.bankIban,
        notes: rawApplication.notes,
        status: rawApplication.status,
        reviewerFeedback: rawApplication.reviewerFeedback,
        approvedOrgId: rawApplication.approvedOrgId,
        events: rawApplication.events.map((e) => ({
          id: e.id,
          fromStatus: e.fromStatus,
          toStatus: e.toStatus,
          note: e.note,
          createdAt: e.createdAt,
        })),
        documents: rawApplication.documents.map((d) => ({
          id: d.id,
          originalFilename: d.originalFilename,
          documentType: d.documentType,
          fileSizeBytes: d.fileSizeBytes,
          createdAt: d.createdAt,
        })),
      }
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Back to store navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5"
        >
          <ArrowLeft size={14} />
          <span>Return to WIZZ.PK Storefront</span>
        </Link>
        <span className="text-xs text-slate-400">
          Logged in as: <strong className="text-slate-700">{user.email}</strong>
        </span>
      </div>

      <SellerOnboardingWorkspace initialApplication={initialApplication} />
    </div>
  );
}
