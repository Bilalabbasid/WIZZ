import Link from "next/link";
import { SITE_CONFIG } from "@/lib/config";
import { ShieldCheck, Truck, RotateCcw, Headphones, Banknote } from "lucide-react";
import { WizzLogo } from "./wizz-logo";
import { getCategories } from "@/modules/catalog/services";

export async function Footer() {
  const categories = (await getCategories()).filter((c) => c._count.products > 0).slice(0, 6);

  return (
    <footer className="bg-brand-ink-deep text-emerald-50/70 text-sm mt-12">
      {/* Guarantees Bar */}
      <div className="border-b border-white/10 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">100% Authentic Stock</h4>
              <p className="text-xs text-emerald-50/70 mt-0.5">Physical inventory verified before dispatch</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
              <Banknote size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Cash on Delivery (COD)</h4>
              <p className="text-xs text-emerald-50/70 mt-0.5">Pay safely at your doorstep nationwide</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
              <Truck size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Tracked Pakistan Delivery</h4>
              <p className="text-xs text-emerald-50/70 mt-0.5">Courier waybills via TCS, Leopards & Trax</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
              <RotateCcw size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">30-Day Transparent Returns</h4>
              <p className="text-xs text-emerald-50/70 mt-0.5">Straightforward return & refund policy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
        {/* Brand Column */}
        <div className="lg:col-span-2 space-y-4">
          <WizzLogo size="md" theme="light" />
          <p className="text-emerald-50/70 text-xs sm:text-sm leading-relaxed max-w-sm">
            WIZZ.PK is an authentic digital marketplace engineered for physical products, featuring real-time inventory hold, nationwide cash on delivery, and transparent multi-seller order fulfillment.
          </p>
          <div className="text-xs text-emerald-50/60 space-y-1">
            <p>Domain: <span className="text-emerald-50/90 font-mono">wizz.pk</span></p>
            <p>Support Inquiries: <span className="text-emerald-50/90">{SITE_CONFIG.supportEmail}</span></p>
          </div>
        </div>

        {/* Catalog Categories */}
        <div>
          <h4 className="text-white font-bold text-xs tracking-wider uppercase mb-4">Departments</h4>
          <ul className="space-y-2.5 text-xs">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/categories/${c.slug}`} className="hover:text-emerald-400 transition-colors">
                  {c.name}
                </Link>
              </li>
            ))}
            <li><Link href="/products" className="hover:text-emerald-400 transition-colors">All products</Link></li>
          </ul>
        </div>

        {/* Merchant & Seller Hub */}
        <div>
          <h4 className="text-white font-bold text-xs tracking-wider uppercase mb-4">Merchants</h4>
          <ul className="space-y-2.5 text-xs">
            <li><Link href="/sell" className="text-emerald-400 hover:text-emerald-300 font-semibold">Sell on WIZZ.PK</Link></li>
            <li><Link href="/seller/onboarding" className="hover:text-white transition-colors">Seller Application Status</Link></li>
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
      <div className="border-t border-white/10 py-6 text-center text-xs text-emerald-50/60">
        <p>© 2026 WIZZ.PK. All rights reserved.</p>
        <p className="mt-1 text-[11px] text-emerald-50/50">
          * Policy content and corporate disclosures marked for official business review. Operating under Pakistan-first commerce principles.
        </p>
      </div>
    </footer>
  );
}
