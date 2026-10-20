import { SITE_CONFIG } from "@/lib/config";
import { Truck, ShieldCheck, Clock, MapPin } from "lucide-react";

export default function ShippingPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">
          Policy & Delivery Standards
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">
          Shipping & Fulfillment Policy
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Last updated: October 2026 • Verified physical product logistics
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 space-y-8 text-slate-700 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Truck size={20} className="text-indigo-600" />
            <span>1. Shipping Rates & Delivery Estimates</span>
          </h2>
          <p>
            WIZZ.PK ships verified physical products from our central fulfillment hubs and authorized merchant warehouses. Shipping charges are calculated dynamically based on package weight, tier, and destination:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
            <li><strong>Standard Tracked Shipping</strong>: PKR 250 flat rate. Complimentary on orders over PKR 3,000. Typical transit time is 2 to 4 business days across Pakistan.</li>
            <li><strong>Express Priority Courier</strong>: PKR 450 flat rate. Priority dispatch via TCS / Leopards Express with 1 to 2 business day delivery to major cities.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck size={20} className="text-indigo-600" />
            <span>2. Real-Time Tracking & Proof of Delivery</span>
          </h2>
          <p>
            Every order generates an authentic carrier waybill (TCS, Leopards Courier, Trax, or Pakistan Post). We never fabricate placeholder delivery statuses. Once your package is scanned at the carrier sorting terminal, tracking checkpoints appear directly in your customer order dashboard.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock size={20} className="text-indigo-600" />
            <span>3. Order Processing & Dispatch Timelines</span>
          </h2>
          <p>
            Orders placed before 2:00 PM PKT on business days are processed and packed the same day. Orders received during Sundays or gazetted public holidays are dispatched the following business morning.
          </p>
        </section>

        <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
          <p>Questions regarding custom shipping regions or freight handling? Contact our operations desk at <strong>{SITE_CONFIG.supportEmail}</strong>.</p>
        </div>
      </div>
    </div>
  );
}
