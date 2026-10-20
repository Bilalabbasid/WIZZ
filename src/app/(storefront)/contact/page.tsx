import { SITE_CONFIG } from "@/lib/config";
import { Headphones, Mail, Phone, MapPin, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">Support & Assistance</span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">
          Contact WIZZ.PK
        </h1>
        <p className="text-xs text-slate-500 mt-1">We're here to assist with hardware inquiries, shipments, and merchant partnerships.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Mail size={20} />
          </div>
          <h3 className="font-bold text-sm text-slate-900">Email Support</h3>
          <p className="text-xs text-slate-500">Typical response within 2-4 hours</p>
          <p className="font-mono font-bold text-xs text-indigo-600">{SITE_CONFIG.supportEmail}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Phone size={20} />
          </div>
          <h3 className="font-bold text-sm text-slate-900">Phone Care</h3>
          <p className="text-xs text-slate-500">Mon - Sat: 9:00 AM - 6:00 PM PKT</p>
          <p className="font-mono font-bold text-xs text-emerald-600">{SITE_CONFIG.supportPhone || "+92 (021) 111-949-975"}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <MapPin size={20} />
          </div>
          <h3 className="font-bold text-sm text-slate-900">Operations Hub</h3>
          <p className="text-xs text-slate-500">Central Logistics Facility</p>
          <p className="font-bold text-xs text-slate-700">Karachi & Lahore Fulfillment Centers, Pakistan</p>
        </div>
      </div>
    </div>
  );
}
