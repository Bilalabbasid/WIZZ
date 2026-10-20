import { SITE_CONFIG } from "@/lib/config";
import { RotateCcw, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function ReturnsPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">
          Buyer Protection
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">
          Returns & Refund Policy
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          30-Day Transparent Return Guarantee for Physical Merchandise
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 space-y-8 text-slate-700 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw size={20} className="text-indigo-600" />
            <span>1. 30-Day Eligibility Window</span>
          </h2>
          <p>
            You may request a return within 30 days of receiving your item. To qualify, merchandise must be in its original physical condition, including original packaging, accessories, manuals, and protective tags.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-indigo-600" />
            <span>2. Return Request Workflow</span>
          </h2>
          <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-600">
            <li>Visit your <strong>Order Details</strong> page in your customer account.</li>
            <li>Click <strong>Request Return</strong> on any delivered physical item.</li>
            <li>Select the reason code (Defective, Damaged, Incorrect Item, or Unwanted) and submit your notes.</li>
            <li>Upon approval, a prepaid return shipping waybill will be generated for warehouse drop-off.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck size={20} className="text-indigo-600" />
            <span>3. Inspection & Automated Restocking Refund</span>
          </h2>
          <p>
            Once received at the warehouse, items undergo inspection. Refunds are issued to your original payment method within 2 business days of verification. Inventory balances are restored safely to the catalog via audited adjustments.
          </p>
        </section>
      </div>
    </div>
  );
}
