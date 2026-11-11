"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Heart, Loader2, Package, ShoppingCart, X } from "lucide-react";
import { CATALOG_GRID, CatalogEmptyState, FOCUS_RING, MONO_LABEL, PILL_INK } from "./catalog-ui";

export interface WishlistListItem {
  productId: string;
  slug: string;
  title: string;
  sellerName: string;
  imageUrl: string | null;
  imageAlt: string;
  priceLabel: string | null;
  compareAtLabel: string | null;
  available: boolean;
  inStock: boolean;
  firstAvailableVariantId: string | null;
}

type RowStatus = { kind: "error" | "success"; message: string };

export function AccountWishlistList({ initialItems }: { initialItems: WishlistListItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const setRowStatus = (productId: string, s: RowStatus | null) =>
    setStatus((prev) => {
      const next = { ...prev };
      if (s) next[productId] = s;
      else delete next[productId];
      return next;
    });

  const remove = async (productId: string) => {
    setBusy(`remove:${productId}`);
    setRowStatus(productId, null);
    try {
      const res = await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, { method: "DELETE" });
      if (res.status === 401) {
        router.push("/login?next=%2Fwishlist");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove this item.");
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch (err) {
      setRowStatus(productId, {
        kind: "error",
        message: err instanceof Error ? err.message : "Could not remove this item.",
      });
    } finally {
      setBusy(null);
    }
  };

  const addToCart = async (item: WishlistListItem) => {
    if (!item.firstAvailableVariantId) return;
    setBusy(`cart:${item.productId}`);
    setRowStatus(item.productId, null);
    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: item.firstAvailableVariantId, quantity: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add this item to your cart.");
      setRowStatus(item.productId, { kind: "success", message: "Added to cart." });
      router.refresh(); // updates the header cart count
    } catch (err) {
      setRowStatus(item.productId, {
        kind: "error",
        message: err instanceof Error ? err.message : "Could not add this item to your cart.",
      });
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return (
      <CatalogEmptyState
        icon={<Heart size={20} aria-hidden="true" />}
        title="Your wishlist is empty"
        actions={
          <Link href="/products" className={PILL_INK}>
            Browse products
          </Link>
        }
      >
        Tap the heart on any product to save it here for later.
      </CatalogEmptyState>
    );
  }

  return (
    <ul className={CATALOG_GRID}>
      {items.map((item) => {
        const rowStatus = status[item.productId];
        const removing = busy === `remove:${item.productId}`;
        const adding = busy === `cart:${item.productId}`;
        const href = `/products/${item.slug}`;
        const dimmed = !item.available || !item.inStock;
        const tag = !item.available ? "Unavailable" : item.inStock ? "In stock" : "Out of stock";

        return (
          <li key={item.productId} className="relative flex flex-col gap-3.5">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[20px] bg-sand">
              {item.imageUrl && !failedImages[item.productId] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => setFailedImages((prev) => ({ ...prev, [item.productId]: true }))}
                  className={`h-full w-full object-cover ${dimmed ? "opacity-55 grayscale-[30%]" : ""}`}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-mute-2" aria-hidden="true">
                  <Package size={40} strokeWidth={1.25} />
                </div>
              )}
              {dimmed && (
                <span className={`absolute bottom-3 left-3 rounded-full bg-ink px-2.5 py-1 text-white ${MONO_LABEL}`} aria-hidden="true">
                  {tag}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => remove(item.productId)}
              disabled={busy !== null}
              aria-label={`Remove ${item.title} from wishlist`}
              title="Remove from wishlist"
              className={`absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-ink transition-colors hover:bg-white disabled:cursor-not-allowed ${FOCUS_RING}`}
            >
              {removing ? (
                <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <X size={18} aria-hidden="true" />
              )}
            </button>

            <div className="flex flex-col gap-1.5 px-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <h3 className="min-w-0 text-[15px] font-semibold leading-snug tracking-[-0.015em] text-ink">
                  <Link href={href} className={`line-clamp-2 rounded-sm hover:underline hover:underline-offset-4 ${FOCUS_RING}`}>
                    {item.title}
                  </Link>
                </h3>
                {item.available && item.priceLabel && (
                  <p className="shrink-0 font-mono text-[15px] font-medium leading-snug text-ink sm:text-right">
                    <span className="whitespace-nowrap">{item.priceLabel}</span>
                    {item.compareAtLabel && (
                      <span className="ml-2 inline-block whitespace-nowrap text-xs font-normal text-mute-2 line-through sm:ml-0 sm:block">
                        <span className="sr-only">Was </span>
                        {item.compareAtLabel}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 text-[13px] text-mute">
                <span className="min-w-0 truncate">{item.sellerName}</span>
                <span className={`shrink-0 ${MONO_LABEL} ${dimmed ? "text-ink" : "text-mute"}`}>{tag}</span>
              </div>

              <button
                type="button"
                onClick={() => addToCart(item)}
                disabled={!item.firstAvailableVariantId || busy !== null}
                className={`mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-medium text-white transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:bg-white disabled:text-mute-2 disabled:ring-1 disabled:ring-line ${FOCUS_RING}`}
              >
                {adding ? (
                  <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <ShoppingCart size={16} aria-hidden="true" />
                )}
                <span>{item.firstAvailableVariantId ? "Add to cart" : !item.available ? "No longer available" : "Out of stock"}</span>
                <span className="sr-only">: {item.title}</span>
              </button>

              <div aria-live="polite">
                {rowStatus && (
                  <p
                    className={`flex flex-wrap items-center gap-1 text-[13px] ${
                      rowStatus.kind === "error" ? "text-rose-700" : "text-ink"
                    }`}
                  >
                    {rowStatus.kind === "error" ? (
                      <AlertCircle size={14} aria-hidden="true" />
                    ) : (
                      <CheckCircle2 size={14} aria-hidden="true" />
                    )}
                    <span>{rowStatus.message}</span>
                    {rowStatus.kind === "success" && (
                      <Link href="/cart" className={`rounded-sm font-medium underline underline-offset-4 ${FOCUS_RING}`}>
                        View cart
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
