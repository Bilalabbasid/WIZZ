import { SITE_CONFIG } from "@/lib/config";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">Legal & Governance</span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">
          Terms of Service
        </h1>
        <p className="text-xs text-slate-500 mt-1">WIZZ.PK E-Commerce Platform Agreement</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 space-y-6 text-slate-700 text-sm leading-relaxed">
        <h2 className="text-base font-bold text-slate-900">1. Acceptance of Terms</h2>
        <p>
          By browsing, purchasing, or registering an account on WIZZ.PK, you agree to comply with and be bound by these Terms of Service. These terms govern both retail transactions for physical products and merchant participation in our marketplace onboarding program.
        </p>

        <h2 className="text-base font-bold text-slate-900">2. Accuracy of Product Information & Inventory</h2>
        <p>
          WIZZ.PK represents real warehouse physical inventory. Listings state authentic specifications, dimensions, weight, and pricing. Temporary stock reservations are held for 15 minutes during checkout to ensure fair allocation without overselling.
        </p>

        <h2 className="text-base font-bold text-slate-900">3. Merchant Standards & Verification</h2>
        <p>
          Sellers applying to join WIZZ.PK must complete formal KYC inspection. Approved sellers operate under strict fulfillment SLA requirements. WIZZ.PK reserves the right to suspend or remove any seller organization failing to fulfill orders accurately.
        </p>
      </div>
    </div>
  );
}
