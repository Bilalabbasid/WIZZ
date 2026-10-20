import { getAllSellerApplications } from "@/modules/sellers/services";
import { AdminApplicationReview } from "@/components/admin-application-review";

export default async function AdminApplicationsPage() {
  const applications = await getAllSellerApplications();

  const mappedApplications = applications.map((a) => ({
    id: a.id,
    applicantUserId: a.applicantUserId,
    legalBusinessName: a.legalBusinessName,
    tradingName: a.tradingName,
    businessRegNumber: a.businessRegNumber,
    taxVatNumber: a.taxVatNumber,
    countryCode: a.countryCode,
    city: a.city,
    addressLine: a.addressLine,
    websiteUrl: a.websiteUrl,
    contactName: a.contactName,
    contactEmail: a.contactEmail,
    contactPhone: a.contactPhone,
    notes: a.notes,
    status: a.status,
    reviewerFeedback: a.reviewerFeedback,
    approvedOrgId: a.approvedOrgId,
    createdAt: a.createdAt,
    applicantUser: {
      email: a.applicantUser.email,
      firstName: a.applicantUser.firstName,
      lastName: a.applicantUser.lastName,
    },
    documents: a.documents.map((d) => ({
      id: d.id,
      originalFilename: d.originalFilename,
      documentType: d.documentType,
      fileSizeBytes: d.fileSizeBytes,
      fileKey: d.fileKey,
    })),
  }));

  return (
    <div className="space-y-8">
      <div>
        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
          Compliance & Onboarding
        </span>
        <h1 className="text-3xl font-black tracking-tight text-white mt-1">
          Seller Applications Review
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Evaluate prospective merchant registrations, examine KYC certificates, and manage authorization decisions.
        </p>
      </div>

      <AdminApplicationReview applications={mappedApplications} />
    </div>
  );
}
