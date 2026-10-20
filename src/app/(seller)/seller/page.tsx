import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSellerApplicationByUserId } from "@/modules/sellers/services";
import Link from "next/link";
import {
  Store,
  ArrowRight,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Lock,
  Layers,
  ShoppingBag,
  FileText,
  DollarSign,
  ArrowLeft,
} from "lucide-react";

export default async function SellerHubPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/seller");
  }

  const application = await getSellerApplicationByUserId(user.id);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <Link
          href="/"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5"
        >
          <ArrowLeft size={14} />
          <span>Return to WIZZ.PK Storefront</span>
        </Link>
        <span className="text-xs text-slate-500">
          Logged in as: <strong className="text-slate-900">{user.email}</strong>
        </span>
      </div>

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-3">
            <Store size={14} />
            <span>WIZZ.PK Merchant Network</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Seller Portal Hub
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage your merchant verification, seller organization, and catalog operations.
          </p>
        </div>

        <div>
          <Link
            href="/seller/onboarding"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
          >
            <FileText size={16} />
            <span>View Onboarding Workspace</span>
          </Link>
        </div>
      </div>

      {/* Application Status Card */}
      {!application ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Store size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Start Your Seller Journey</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            You haven't submitted a seller application yet. Join the WIZZ.PK marketplace to offer your products to thousands of shoppers.
          </p>
          <div>
            <Link
              href="/seller/onboarding"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              <span>Begin KYC Application</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : application.status !== "APPROVED" ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                application.status === "CHANGES_REQUESTED"
                  ? "bg-amber-100 text-amber-700"
                  : application.status === "REJECTED"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {application.status === "CHANGES_REQUESTED" ? (
                <AlertTriangle size={20} />
              ) : (
                <Clock size={20} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {application.tradingName || application.legalBusinessName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {application.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Application ID: #{application.id.slice(-8)} &bull; Submitted on{" "}
                {new Date(application.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-2">
            <p className="font-semibold text-slate-900">Current Verification Status:</p>
            {application.status === "SUBMITTED" && (
              <p>
                Your application and uploaded KYC documents are currently in review by the WIZZ.PK Platform Compliance team.
              </p>
            )}
            {application.status === "CHANGES_REQUESTED" && (
              <p className="text-amber-800 font-medium">
                Changes have been requested: "{application.reviewerFeedback}". Please update your application in the workspace.
              </p>
            )}
            {application.status === "DRAFT" && (
              <p>Your application is currently in draft mode. Complete all required fields and submit for review.</p>
            )}
          </div>

          <div>
            <Link
              href="/seller/onboarding"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              <span>Open Onboarding Workspace</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        /* APPROVED SELLER VIEW */
        <div className="space-y-6">
          {/* Org Header Card */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-lg">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {application.tradingName || application.legalBusinessName}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Verified Seller
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Legal Name: {application.legalBusinessName} &bull; Reg: {application.businessRegNumber || "N/A"}
                  </p>
                </div>
              </div>

              <Link
                href="/seller/portal"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
              >
                <span>Launch Seller Portal</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Stage 1 Rollout Notice Card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-8 border border-slate-800 shadow-md space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Lock size={14} />
              <span>Architecture Notice &bull; Stage 1 Boundary</span>
            </div>
            <h3 className="text-xl font-black tracking-tight text-white">
              Self-Serve Portal Gated under Stage 1 Rollout Flag
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Congratulations! Your seller organization is fully registered and approved on WIZZ.PK.
              In <strong>Stage 1</strong>, all retail orders and catalog offerings are fulfilled through WIZZ.PK 1P operations to guarantee fulfillment quality and build platform liquidity.
              In <strong>Stage 2</strong>, the server flag <code className="bg-slate-800 text-indigo-300 px-2 py-0.5 rounded text-[11px]">FEATURE_SELLER_PORTAL_ACTIVE</code> unlocks full multi-tenant catalog publishing, automated SKU routing, and direct sub-order waybill generation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold">
                  <Layers size={14} />
                  <span>3P Product Catalog</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Direct merchant SKU creation, variant management, and price controls will activate in Stage 2.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold">
                  <ShoppingBag size={14} />
                  <span>Sub-Order Dispatch</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Atomic multi-seller order splitting is pre-wired in the core domain and ready for tenant fulfillment.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold">
                  <DollarSign size={14} />
                  <span>Marketplace Settlements</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Automated net commission payout ledger accounts are designed for activation in Stage 3.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
