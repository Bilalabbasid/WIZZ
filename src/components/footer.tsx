import Link from "next/link";
import { SITE_CONFIG } from "@/lib/config";
import { ShieldCheck, Truck, RotateCcw, Headphones, Banknote } from "lucide-react";
import { WizzLogo } from "./wizz-logo";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 text-sm mt-20 border-t border-slate-900">
      {/* Guarantees Bar */}
      <div className="border-b border-slate-900 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">100% Authentic Stock</h4>
              <p className="text-xs text-slate-400 mt-0.5">Physical inventory verified before dispatch</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <Banknote size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Cash on Delivery (COD)</h4>
              <p className="text-xs text-slate-400 mt-0.5">Pay safely at your doorstep nationwide</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <Truck size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Tracked Pakistan Delivery</h4>
              <p className="text-xs text-slate-400 mt-0.5">Courier waybills via TCS, Leopards & Trax</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <RotateCcw size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">30-Day Transparent Returns</h4>
              <p className="text-xs text-slate-400 mt-0.5">Straightforward return & refund policy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
        {/* Brand Column */}
        <div className="lg:col-span-2 space-y-4">
          <WizzLogo size="md" theme="light" />
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm">
            WIZZ.PK is an authentic digital marketplace engineered for physical products, featuring real-time inventory hold, nationwide cash on delivery, and transparent multi-seller order fulfillment.
          </p>
          <div className="text-xs text-slate-500 space-y-1">
            <p>Domain: <span className="text-slate-300 font-mono">wizz.pk</span></p>
            <p>Support Inquiries: <span className="text-slate-300">{SITE_CONFIG.supportEmail}</span></p>
          </div>
        </div>

        {/* Catalog Categories */}
        <div>
          <h4 className="text-white font-bold text-xs tracking-wider uppercase mb-4">Departments</h4>
          <ul className="space-y-2.5 text-xs">
            <li><Link href="/categories/electronics-audio" className="hover:text-emerald-400 transition-colors">Electronics & Audio</Link></li>
            <li><Link href="/categories/outdoor-travel-gear" className="hover:text-emerald-400 transition-colors">Outdoor & Travel</Link></li>
            <li><Link href="/categories/work-productivity" className="hover:text-emerald-400 transition-colors">Work & Productivity</Link></li>
            <li><Link href="/categories/home-lifestyle" className="hover:text-emerald-400 transition-colors">Home & Lifestyle</Link></li>
            <li><Link href="/products" className="hover:text-emerald-400 transition-colors">Full Catalog</Link></li>
          </ul>
        </div>

        {/* Merchant & Seller Hub */}
        <div>
          <h4 className="text-white font-bold text-xs tracking-wider uppercase mb-4">Merchants</h4>
          <ul className="space-y-2.5 text-xs">
            <li><Link href="/sell" className="text-emerald-400 hover:text-emerald-300 font-semibold">Sell on WIZZ.PK</Link></li>
            <li><Link href="/seller/onboarding" className="hover:text-white transition-colors">Seller Application Status</Link></li>
            <li><Link href="/admin" className="hover:text-white transition-colors">Platform Administration</Link></li>
            <li><Link href="/policies/terms" className="hover:text-white transition-colors">Seller Guidelines (Draft)</Link></li>
          </ul>
        </div>

        {/* Policies & Help */}
        <div>
          <h4 className="text-white font-bold text-xs tracking-wider uppercase mb-4">Policies & Help</h4>
          <ul className="space-y-2.5 text-xs">
            <li><Link href="/policies/shipping" className="hover:text-white transition-colors">Shipping & Delivery</Link></li>
            <li><Link href="/policies/returns" className="hover:text-white transition-colors">Returns & Refunds</Link></li>
            <li><Link href="/policies/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            <li><Link href="/policies/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            <li><Link href="/contact" className="hover:text-white transition-colors">Contact Support</Link></li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>© 2026 WIZZ.PK. All rights reserved.</p>
        <p className="mt-1 text-[11px] text-slate-600">
          * Policy content and corporate disclosures marked for official business review. Operating under Pakistan-first commerce principles.
        </p>
      </div>
    </footer>
  );
}
