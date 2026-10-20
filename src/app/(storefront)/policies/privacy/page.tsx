import { SITE_CONFIG } from "@/lib/config";

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">Data Privacy</span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">
          Privacy Policy
        </h1>
        <p className="text-xs text-slate-500 mt-1">How WIZZ.PK collects, protects, and handles your information</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 space-y-6 text-slate-700 text-sm leading-relaxed">
        <h2 className="text-base font-bold text-slate-900">1. Information We Collect</h2>
        <p>
          We collect personal information necessary to deliver physical products and comply with legal requirements: full name, shipping and billing addresses, email address, phone number, and encrypted authentication credentials. For prospective marketplace sellers, we also collect business registration identifiers and tax documentation.
        </p>

        <h2 className="text-base font-bold text-slate-900">2. Payment Security</h2>
        <p>
          WIZZ.PK never stores raw credit or debit card numbers on local application servers. All payment transactions are processed through tokenized, PCI-DSS certified payment providers.
        </p>

        <h2 className="text-base font-bold text-slate-900">3. Tenant Isolation & Document Protection</h2>
        <p>
          Merchant compliance documents (KYC files, business certificates) reside in private object storage protected by signed, short-lived URLs. Seller organizations cannot view customer financial records, and third-party sellers never access customer data outside their specific order fulfillment scope.
        </p>
      </div>
    </div>
  );
}
