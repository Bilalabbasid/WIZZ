import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SITE_CONFIG } from "@/lib/config";
import type { Metadata } from "next";
import {
  Store,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  ArrowRight,
  TrendingUp,
  Layers,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Sell on WIZZ.PK | Merchant Partnership & Multi-Seller Platform",
  description: "Become a verified merchant partner on WIZZ.PK. Reach high-intent buyers across Pakistan with reliable fulfillment, next-day settlements, and complete brand control.",
  alternates: {
    canonical: `${SITE_CONFIG.canonicalUrl}/sell`,
  },
  openGraph: {
    title: "Sell on WIZZ.PK - Merchant Partnership",
    description: "Scale your commerce business on Pakistan's premier verified hardware & technology marketplace.",
    url: `${SITE_CONFIG.canonicalUrl}/sell`,
  },
};

export default async function SellLandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-16 pb-16">
      {/* Hero */}
      <section className="brand-gradient text-white py-20 lg:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-xs font-semibold">
              <Store size={14} className="text-indigo-400" />
              <span>Merchant Partnerships</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Grow Your Brand on <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-indigo-100 to-emerald-300">
                WIZZ.PK Marketplace
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
              Connect with customers seeking high-quality physical products. Our structured onboarding ensures only genuine brands and verified businesses reach our storefront.
            </p>

            <div className="pt-2">
              <Link href={user ? "/seller/onboarding" : "/seller/register"}>
                <Button size="lg" className="shadow-lg shadow-indigo-600/30">
                  <span>{user ? "Go to Onboarding Workspace" : "Register as a Merchant"}</span>
                  <ArrowRight size={18} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Onboarding Lifecycle Steps */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">
            Transparent Process
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            How Seller Onboarding Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Every seller undergoes verified evaluation to maintain buyer trust and catalog integrity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 space-y-3 relative">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-black text-sm flex items-center justify-center">
              1
            </div>
            <h3 className="font-bold text-base text-slate-900">Account Creation</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Register your credentials and access the self-service Seller Onboarding Workspace.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 space-y-3 relative">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-black text-sm flex items-center justify-center">
              2
            </div>
            <h3 className="font-bold text-base text-slate-900">Business KYC Details</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Provide legal company registration, tax identifiers, warehouse pickup addresses, and compliance documents.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 space-y-3 relative">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-black text-sm flex items-center justify-center">
              3
            </div>
            <h3 className="font-bold text-base text-slate-900">Admin Review & Notes</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              WIZZ.PK evaluates your application. If adjustments are needed, admins provide structured feedback notes for quick resubmission.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 space-y-3 relative">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 font-black text-sm flex items-center justify-center">
              4
            </div>
            <h3 className="font-bold text-base text-slate-900">Approval & Activation</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upon approval, your dedicated Seller Organization is provisioned with Owner permissions for store rollout.
            </p>
          </div>
        </div>
      </section>

      {/* Rollout Note & CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 max-w-xl">
            <Badge variant="warning">Stage 1 Onboarding Active</Badge>
            <h3 className="text-xl sm:text-2xl font-black">
              Ready to submit your application?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Applicants can track progress, respond to admin feedback, and upload documentation directly inside the Onboarding Workspace.
            </p>
          </div>

          <Link href={user ? "/seller/onboarding" : "/seller/register"}>
            <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100 font-bold">
              <span>{user ? "Open Onboarding Workspace" : "Register to Apply"}</span>
              <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
