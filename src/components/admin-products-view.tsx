"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Layers, AlertCircle, CheckCircle2, Star, Check } from "lucide-react";

export interface AdminProductItem {
  id: string;
  title: string;
  slug: string;
  featured: boolean;
  status: string;
  category: { name: string };
  brand?: { name: string } | null;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    priceMinor: number;
    inventoryLevel?: { availableUnits: number; reservedUnits: number } | null;
  }>;
  media: Array<{ url: string }>;
}

/** Lists what a seller's staged revision would change, so reviewers know what they approve. */
function summarizeRevision(json: string | null | undefined, currentTitle: string): string[] {
  if (!json) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rev: any;
  try {
    rev = JSON.parse(json);
  } catch {
    return ["Staged revision could not be read"];
  }
  const out: string[] = [];
  if (rev.title && rev.title !== currentTitle) out.push(`Title: "${rev.title}"`);
  if (rev.description !== undefined) out.push("Description rewritten");
  if (rev.images) out.push(`Photos: ${rev.images.length} image(s), new set`);
  if (rev.categoryId) out.push("Category changed");
  if (rev.brandId !== undefined) out.push("Brand changed");
  if (rev.attributes) out.push(`Specifications: ${Object.keys(rev.attributes).length} field(s)`);
  if (rev.metaTitle !== undefined || rev.metaDescription !== undefined) out.push("SEO text changed");
  if (rev.slug) out.push(`URL: /products/${rev.slug}`);
  if (rev.weightGrams !== undefined || rev.lengthMm !== undefined) out.push("Package size/weight changed");
  if (rev.variantContent?.length) out.push(`${rev.variantContent.length} variant name/SKU change(s)`);
  if (rev.newVariants?.length) out.push(`${rev.newVariants.length} new variant(s)`);
  if (rev.variants?.length && !rev.variantContent) out.push(`${rev.variants.length} variant(s) (legacy revision)`);
  return out.length ? out : ["No visible content changes"];
}

async function postModeration(productId: string, body: Record<string, string>) {
  const res = await fetch(`/api/admin/products/${productId}/moderation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    window.location.reload();
    return;
  }
  const data = await res.json().catch(() => ({}));
  window.alert(data.error || "The moderation action failed. Please try again.");
}

export function AdminProductsView({
  products: initialProducts,
  categories,
  brands,
}: {
  products: AdminProductItem[];
  categories: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [brandId, setBrandId] = useState(brands[0]?.id || "");
  const [sku, setSku] = useState("");
  const [variantTitle, setVariantTitle] = useState("Standard Edition");
  const [priceDollars, setPriceDollars] = useState("2499.00");
  const [stock, setStock] = useState("25");
  const [imageUrl, setImageUrl] = useState("");
  const [featured, setFeatured] = useState(false);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const priceMinor = Math.round(Number(priceDollars) * 100);
    if (!priceMinor || priceMinor <= 0) {
      setFormError("Valid price is required.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          categoryId,
          brandId: brandId || undefined,
          initialSku: sku,
          variantTitle,
          priceMinor,
          initialStock: Number(stock) || 10,
          imageUrl,
          featured,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create product.");

      window.location.reload();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error creating product");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-300">
          WIZZ.PK Direct Catalog Listings ({products.length})
        </h3>
        <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1.5">
          <Plus size={16} />
          <span>Add 1P Listing</span>
        </Button>
      </div>

      <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 overflow-hidden divide-y divide-slate-700/60">
        {products.map((p) => {
          const mainVariant = p.variants[0];
          const totalStock = p.variants.reduce((sum, v) => {
            const level = v.inventoryLevel;
            return sum + Math.max(0, (level?.availableUnits || 0) - (level?.reservedUnits || 0));
          }, 0);

          const hasPendingRevisions = Boolean((p as any).pendingChangesJson);
          const modStatus = (p as any).moderationStatus || "DRAFT";

          return (
            <div key={p.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden flex-shrink-0">
                  {p.media[0]?.url ? (
                    <img src={p.media[0].url} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">
                      No img
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm line-clamp-1">{p.title}</span>
                    {p.featured && (
                      <Badge variant="warning" size="sm">
                        <Star size={10} className="fill-amber-400" />
                        <span>Featured</span>
                      </Badge>
                    )}
                    {hasPendingRevisions && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Revision Pending
                      </span>
                    )}
                    {modStatus === "PENDING_REVIEW" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Awaiting Review
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Seller: <strong className="text-emerald-400">{(p as any).sellerOrg?.name || "WIZZ.PK Direct"}</strong> &bull; Category: <strong className="text-slate-300">{p.category.name}</strong> &bull; Main SKU:{" "}
                    <span className="font-mono text-slate-300">{mainVariant?.sku || "N/A"}</span>
                  </p>
                  {hasPendingRevisions && (
                    <div className="text-[11px] text-indigo-200 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2.5 py-1.5">
                      <span className="font-bold">Proposed changes:</span>{" "}
                      {summarizeRevision((p as any).pendingChangesJson, p.title).join("; ")}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-right self-end md:self-auto">
                <div>
                  <span className="font-black text-white text-sm">
                    {formatCurrency(mainVariant?.priceMinor || 0)}
                  </span>
                  <p className="text-[11px] text-slate-400">{p.variants.length} variant(s)</p>
                </div>

                <div className="min-w-[80px]">
                  <Badge variant={totalStock > 0 ? "success" : "danger"} size="sm">
                    {totalStock} in stock
                  </Badge>
                </div>

                {/* Moderation Controls for pending products or pending revisions */}
                {(modStatus === "PENDING_REVIEW" || hasPendingRevisions) && (
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Approve listing / staged revisions for "${p.title}"?`)) return;
                        await postModeration(p.id, { action: "APPROVE" });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const reason = prompt("Enter requested changes or correction notes:");
                        if (!reason) return;
                        await postModeration(p.id, { action: "REQUEST_CHANGES", reason });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white font-bold text-[10px] transition"
                    >
                      Request Changes
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl border border-slate-700 max-w-xl w-full p-6 space-y-5 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white">Create WIZZ.PK 1P Listing</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                  Product Title
                </label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. WIZZ.PK Stealth Titanium EDC Pen"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                  Description
                </label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="High-precision aerospace grade titanium alloy with pressurized ink refill..."
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                    Brand
                  </label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-white"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                    SKU Code
                  </label>
                  <input
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="WZ-PEN-01"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                    Price (PKR)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={priceDollars}
                    onChange={(e) => setPriceDollars(e.target.value)}
                    placeholder="2499.00"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                    Initial Stock
                  </label>
                  <input
                    required
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="25"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                  Image URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="feat"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600"
                />
                <label htmlFor="feat" className="text-slate-300">
                  Feature this product on storefront homepage
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmitting}>
                  Publish Listing & Receive Stock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
