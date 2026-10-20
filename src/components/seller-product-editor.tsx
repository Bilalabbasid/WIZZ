"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Plus,
  Trash2,
  Image as ImageIcon,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Layers,
  Boxes,
  Tag,
  Search,
  ExternalLink,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Globe,
  Settings,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPkr } from "@/lib/formatters";

interface ProductImageItem {
  id?: string;
  url: string;
  altText: string;
  isThumbnail: boolean;
  displayOrder: number;
  uploadProgress?: number; // 0-100
}

interface ProductVariantItem {
  id?: string;
  title: string;
  sku: string;
  pricePkr: number;
  compareAtPricePkr: number | "";
  costPricePkr?: number | "";
  barcode?: string;
  stock: number;
  lowStockThreshold: number;
  attributes: Record<string, string>;
  isActive: boolean;
}

interface AttributeItem {
  key: string;
  value: string;
}

interface OptionDefinition {
  name: string; // e.g. "Size", "Color"
  values: string[]; // e.g. ["Small", "Medium"], ["Black", "White"]
}

interface SellerProductEditorProps {
  initialProductId?: string; // If editing existing product
}

export function SellerProductEditor({ initialProductId }: SellerProductEditorProps) {
  const router = useRouter();

  // Reference data
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [canSell, setCanSell] = useState<boolean>(true);

  // Core product fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("DRAFT");
  const [moderationStatus, setModerationStatus] = useState<string>("DRAFT");
  const [moderationNotes, setModerationNotes] = useState<string | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);
  const [weightGrams, setWeightGrams] = useState(500);

  // SEO fields
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  // Attributes
  const [attributes, setAttributes] = useState<AttributeItem[]>([
    { key: "Warranty", value: "7 Days Replacement Warranty" },
    { key: "Origin", value: "Pakistan" },
  ]);

  // Images
  const [images, setImages] = useState<ProductImageItem[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Matrix generation & variants
  const [optionDefs, setOptionDefs] = useState<OptionDefinition[]>([
    { name: "Size", values: ["Standard"] },
  ]);
  const [variants, setVariants] = useState<ProductVariantItem[]>([
    {
      title: "Standard",
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      pricePkr: 2499,
      compareAtPricePkr: "",
      stock: 20,
      lowStockThreshold: 5,
      attributes: { Size: "Standard" },
      isActive: true,
    },
  ]);

  // Bulk actions state
  const [bulkPrice, setBulkPrice] = useState<string>("");
  const [bulkStock, setBulkStock] = useState<string>("");
  const [bulkCompareAt, setBulkCompareAt] = useState<string>("");

  // UI state
  const [activeTab, setActiveTab] = useState<"general" | "images" | "variants" | "attributes" | "seo">("general");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(initialProductId));
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load categories and existing product data
  useEffect(() => {
    Promise.all([
      fetch("/api/seller/categories").then((r) => r.json()),
      fetch("/api/seller/context").then((r) => r.json()),
      initialProductId
        ? fetch(`/api/seller/products/${initialProductId}`).then((r) => r.json())
        : Promise.resolve(null),
    ])
      .then(([catData, ctxData, prodData]) => {
        if (catData.categories) {
          setCategories(catData.categories);
          if (!initialProductId && catData.categories.length > 0) {
            setCategoryId(catData.categories[0].id);
          }
        }
        if (catData.brands) setBrands(catData.brands);
        if (ctxData.context) setCanSell(ctxData.context.canSell);

        if (prodData && prodData.product) {
          const p = prodData.product;
          setTitle(p.title);
          setSlug(p.slug || "");
          setDescription(p.description);
          setCategoryId(p.categoryId);
          setBrandId(p.brandId || "");
          setStatus(p.status);
          setModerationStatus(p.moderationStatus || "DRAFT");
          setModerationNotes(p.moderationNotes || null);
          setHasPendingChanges(Boolean(p.pendingChangesJson));
          setWeightGrams(p.weightGrams || 500);
          setMetaTitle(p.metaTitle || "");
          setMetaDescription(p.metaDescription || "");

          // Parse attributes
          try {
            const parsedAttrs = JSON.parse(p.attributesJson || "{}");
            const attrArray = Object.entries(parsedAttrs).map(([key, value]) => ({
              key,
              value: String(value),
            }));
            if (attrArray.length > 0) setAttributes(attrArray);
          } catch {
            // Keep defaults
          }

          // Populate images
          if (p.media && p.media.length > 0) {
            setImages(
              p.media.map((m: any, idx: number) => ({
                id: m.id,
                url: m.url,
                altText: m.altText || p.title,
                isThumbnail: m.isThumbnail ?? idx === 0,
                displayOrder: m.displayOrder ?? idx,
              }))
            );
          }

          // Populate variants
          if (p.variants && p.variants.length > 0) {
            setVariants(
              p.variants.map((v: any) => {
                let parsedAttrs: Record<string, string> = {};
                try {
                  parsedAttrs = JSON.parse(v.attributesJson || "{}");
                } catch {}
                return {
                  id: v.id,
                  title: v.title,
                  sku: v.sku,
                  pricePkr: v.priceMinor / 100,
                  compareAtPricePkr: v.compareAtPriceMinor ? v.compareAtPriceMinor / 100 : "",
                  costPricePkr: v.costPriceMinor ? v.costPriceMinor / 100 : "",
                  barcode: v.barcode || "",
                  stock: v.inventoryLevel?.availableUnits ?? 0,
                  lowStockThreshold: v.inventoryLevel?.lowStockThreshold ?? 5,
                  attributes: parsedAttrs,
                  isActive: v.isActive,
                };
              })
            );
          }
        }
      })
      .catch((err) => setErrorMessage(err.message))
      .finally(() => setIsLoading(false));
  }, [initialProductId]);

  // Auto-generate slug when title changes (if new product)
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!initialProductId) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setSlug(generated);
    }
  };

  // ----------------------------------------------------
  // Image Upload & Management Handlers
  // ----------------------------------------------------
  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    const newImg: ProductImageItem = {
      url: newImageUrl.trim(),
      altText: title || "Product image",
      isThumbnail: images.length === 0,
      displayOrder: images.length,
    };
    setImages([...images, newImg]);
    setNewImageUrl("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    setErrorMessage(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.url) {
          setImages((prev) => [
            ...prev,
            {
              url: data.url,
              altText: file.name.replace(/\.[^/.]+$/, ""),
              isThumbnail: prev.length === 0,
              displayOrder: prev.length,
            },
          ]);
        } else {
          setErrorMessage(data.error || "Failed uploading image");
        }
      } catch {
        setErrorMessage("Upload failed. You may also specify direct image URLs.");
      }
    }
    setIsUploadingImage(false);
  };

  const handleSetPrimaryImage = (index: number) => {
    setImages(
      images.map((img, i) => ({
        ...img,
        isThumbnail: i === index,
      }))
    );
  };

  const handleMoveImage = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= images.length) return;
    const newItems = [...images];
    const temp = newItems[index];
    newItems[index] = newItems[targetIdx];
    newItems[targetIdx] = temp;
    // update displayOrder
    setImages(newItems.map((img, i) => ({ ...img, displayOrder: i })));
  };

  const handleRemoveImage = (index: number) => {
    const remaining = images.filter((_, i) => i !== index);
    // ensure at least one thumbnail if items exist
    if (remaining.length > 0 && !remaining.some((img) => img.isThumbnail)) {
      remaining[0].isThumbnail = true;
    }
    setImages(remaining.map((img, i) => ({ ...img, displayOrder: i })));
  };

  const handleUpdateImageAlt = (index: number, alt: string) => {
    setImages(
      images.map((img, i) => (i === index ? { ...img, altText: alt } : img))
    );
  };

  // ----------------------------------------------------
  // Variant Matrix Generation & Validation
  // ----------------------------------------------------
  const handleAddOptionDef = () => {
    setOptionDefs([...optionDefs, { name: `Option ${optionDefs.length + 1}`, values: [""] }]);
  };

  const handleRemoveOptionDef = (index: number) => {
    setOptionDefs(optionDefs.filter((_, i) => i !== index));
  };

  const handleOptionNameChange = (index: number, name: string) => {
    const updated = [...optionDefs];
    updated[index].name = name;
    setOptionDefs(updated);
  };

  const handleOptionValuesChange = (index: number, valuesStr: string) => {
    const vals = valuesStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = [...optionDefs];
    updated[index].values = vals.length > 0 ? vals : ["Default"];
    setOptionDefs(updated);
  };

  const handleGenerateMatrix = () => {
    // Generate Cartesian product of all option values
    const validDefs = optionDefs.filter((od) => od.name.trim() && od.values.length > 0);
    if (validDefs.length === 0) return;

    let combinations: Array<Record<string, string>> = [{}];
    for (const def of validDefs) {
      const nextCombos: Array<Record<string, string>> = [];
      for (const existingCombo of combinations) {
        for (const val of def.values) {
          nextCombos.push({ ...existingCombo, [def.name]: val });
        }
      }
      combinations = nextCombos;
    }

    // Convert combinations into Variant items
    const basePrice = variants[0]?.pricePkr || 2499;
    const baseSkuPrefix = title ? title.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "SKU") : "WIZ";

    const newVariants: ProductVariantItem[] = combinations.map((combo, idx) => {
      const comboTitle = Object.values(combo).join(" / ");
      const comboSkuSuffix = Object.values(combo)
        .map((v) => v.slice(0, 3).toUpperCase())
        .join("-");
      return {
        title: comboTitle,
        sku: `${baseSkuPrefix}-${comboSkuSuffix}-${idx + 101}`,
        pricePkr: basePrice,
        compareAtPricePkr: "",
        stock: 25,
        lowStockThreshold: 5,
        attributes: combo,
        isActive: true,
      };
    });

    setVariants(newVariants);
  };

  const handleAddSingleVariant = () => {
    const nextIdx = variants.length + 1;
    setVariants([
      ...variants,
      {
        title: `Variant ${nextIdx}`,
        sku: `SKU-${Date.now().toString().slice(-4)}-${nextIdx}`,
        pricePkr: 2499,
        compareAtPricePkr: "",
        stock: 10,
        lowStockThreshold: 5,
        attributes: {},
        isActive: true,
      },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      setErrorMessage("At least one product variant is required.");
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (
    index: number,
    field: keyof ProductVariantItem,
    val: any
  ) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: val };
    setVariants(updated);
  };

  // Bulk Apply to All Variants
  const handleApplyBulk = () => {
    const updated = variants.map((v) => {
      let p = v.pricePkr;
      let c = v.compareAtPricePkr;
      let s = v.stock;

      if (bulkPrice && !isNaN(Number(bulkPrice))) {
        p = Math.max(0, Number(bulkPrice));
      }
      if (bulkCompareAt !== "") {
        c = Number(bulkCompareAt) > 0 ? Number(bulkCompareAt) : "";
      }
      if (bulkStock && !isNaN(Number(bulkStock))) {
        s = Math.max(0, parseInt(bulkStock, 10));
      }

      return {
        ...v,
        pricePkr: p,
        compareAtPricePkr: c,
        stock: s,
      };
    });

    setVariants(updated);
    setBulkPrice("");
    setBulkCompareAt("");
    setBulkStock("");
  };

  // ----------------------------------------------------
  // Attributes Handlers
  // ----------------------------------------------------
  const handleAddAttribute = (presetKey?: string, presetVal?: string) => {
    setAttributes([
      ...attributes,
      { key: presetKey || `Spec ${attributes.length + 1}`, value: presetVal || "" },
    ]);
  };

  const handleRemoveAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleAttributeChange = (index: number, key: string, value: string) => {
    const updated = [...attributes];
    updated[index] = { key, value };
    setAttributes(updated);
  };

  // ----------------------------------------------------
  // Save & Submission Handlers
  // ----------------------------------------------------
  const validateBeforeSubmit = (isDraft: boolean): string | null => {
    if (!title.trim()) return "Product title is required.";
    if (!categoryId) return "Please select a product category.";
    if (!isDraft && !description.trim()) return "Product description is required for publishing.";

    // Validate Variants
    if (variants.length === 0) return "At least one variant is required.";

    const seenSkus = new Set<string>();
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.sku.trim()) return `Variant #${i + 1} is missing a SKU.`;

      const norm = v.sku.trim().toUpperCase();
      if (seenSkus.has(norm)) {
        return `Duplicate SKU detected: "${v.sku}". Each variant must have a unique SKU.`;
      }
      seenSkus.add(norm);

      if (v.pricePkr < 0) return `Variant "${v.sku}" price cannot be negative.`;
      if (v.stock < 0) return `Variant "${v.sku}" stock cannot be negative.`;

      if (v.compareAtPricePkr !== "" && Number(v.compareAtPricePkr) <= Number(v.pricePkr)) {
        return `Variant "${v.sku}": Compare-at promotional price (Rs. ${v.compareAtPricePkr}) must be strictly greater than selling price (Rs. ${v.pricePkr}).`;
      }
    }

    if (!isDraft && images.length === 0) {
      return "Please add at least one product image before publishing.";
    }

    return null;
  };

  const handleSave = async (submitForReview = false) => {
    setErrorMessage(null);
    setSaveMessage(null);

    const validationErr = validateBeforeSubmit(!submitForReview);
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    setIsSaving(true);

    try {
      // Build attribute dictionary
      const attrRecord: Record<string, string> = {};
      attributes.forEach((a) => {
        if (a.key.trim() && a.value.trim()) {
          attrRecord[a.key.trim()] = a.value.trim();
        }
      });

      const payload = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        description,
        categoryId,
        brandId: brandId || null,
        status: submitForReview ? "PUBLISHED" : status,
        submitForReview,
        stageEditsIfPublished: true, // Safeguard: preserves live approved version
        weightGrams: Number(weightGrams) || 500,
        metaTitle: metaTitle.trim() || null,
        metaDescription: metaDescription.trim() || null,
        attributes: attrRecord,
        images: images.map((img, idx) => ({
          url: img.url,
          altText: img.altText || title,
          isThumbnail: img.isThumbnail,
          displayOrder: idx,
        })),
        variants: variants.map((v) => ({
          id: v.id,
          title: v.title.trim(),
          sku: v.sku.trim(),
          priceMinor: Math.round(v.pricePkr * 100),
          compareAtPriceMinor:
            v.compareAtPricePkr !== "" ? Math.round(Number(v.compareAtPricePkr) * 100) : null,
          costPriceMinor:
            v.costPricePkr !== "" && v.costPricePkr != null
              ? Math.round(Number(v.costPricePkr) * 100)
              : null,
          barcode: v.barcode || null,
          attributes: v.attributes,
          isActive: v.isActive,
          availableUnits: Math.max(0, Math.floor(v.stock)),
        })),
      };

      const endpoint = initialProductId
        ? `/api/seller/products/${initialProductId}`
        : "/api/seller/products";
      const method = initialProductId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save product.");
      }

      setSaveMessage(
        submitForReview
          ? "Product submitted for platform approval! Live public listings remain safe."
          : "Product draft saved successfully."
      );

      if (!initialProductId && data.product?.id) {
        router.push(`/seller/portal/products/${data.product.id}`);
      } else if (data.product) {
        setModerationStatus(data.product.moderationStatus || "DRAFT");
        setHasPendingChanges(Boolean(data.product.pendingChangesJson));
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error saving product.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center space-y-4">
        <RefreshCw className="animate-spin text-indigo-600 mx-auto" size={32} />
        <p className="text-xs font-semibold text-slate-500">Loading product editor...</p>
      </div>
    );
  }

  const primaryImage = images.find((i) => i.isThumbnail) || images[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm sticky top-20 z-40">
        <div className="flex items-center gap-3">
          <Link
            href="/seller/portal/products"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight truncate max-w-md">
                {title || (initialProductId ? "Edit Listing" : "Create New Product")}
              </h1>
              {/* Moderation Badge */}
              <Badge
                variant={
                  moderationStatus === "APPROVED"
                    ? "success"
                    : moderationStatus === "PENDING_REVIEW"
                    ? "warning"
                    : moderationStatus === "CHANGES_REQUESTED"
                    ? "warning"
                    : moderationStatus === "REJECTED"
                    ? "danger"
                    : "neutral"
                }
                className="text-[11px] font-bold uppercase tracking-wider"
              >
                {moderationStatus === "PENDING_REVIEW"
                  ? "Under Review"
                  : moderationStatus === "CHANGES_REQUESTED"
                  ? "Changes Requested"
                  : moderationStatus}
              </Badge>
              {status === "PUBLISHED" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Live on Store
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {variants.length} variant(s) configured &bull; {images.length} photo(s)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Storefront Live Preview Modal Trigger */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewOpen(true)}
            className="text-xs"
          >
            <Eye size={14} />
            <span>Storefront Preview</span>
          </Button>

          {/* Save Draft */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleSave(false)}
            isLoading={isSaving}
            disabled={isSaving}
            className="text-xs font-semibold"
          >
            <Save size={14} />
            <span>Save Draft</span>
          </Button>

          {/* Submit / Publish */}
          <Button
            type="button"
            size="sm"
            onClick={() => handleSave(true)}
            isLoading={isSaving}
            disabled={isSaving}
            className="text-xs font-bold shadow-md shadow-emerald-600/20"
          >
            <Send size={14} />
            <span>{status === "PUBLISHED" ? "Submit Revisions" : "Publish Listing"}</span>
          </Button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {saveMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 text-xs font-semibold">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3 text-xs font-semibold">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Moderation Feedback Banner */}
      {moderationNotes && (moderationStatus === "CHANGES_REQUESTED" || moderationStatus === "REJECTED") && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
            <AlertCircle size={16} className="text-amber-600" />
            <span>Reviewer Feedback & Action Items</span>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed pl-6 bg-white/70 p-3 rounded-xl border border-amber-200/80">
            {moderationNotes}
          </p>
          <p className="text-[11px] text-amber-800 pl-6">
            Make the requested corrections below and click <strong>Submit Revisions</strong> to resubmit for platform approval.
          </p>
        </div>
      )}

      {/* Staged Revisions Banner for Published Products */}
      {hasPendingChanges && moderationStatus === "PENDING_REVIEW" && status === "PUBLISHED" && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex items-start gap-3 text-xs">
          <HelpCircle size={16} className="text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Pending Revisions Under Platform Review</p>
            <p className="text-slate-600 leading-relaxed">
              Your edits are staged and awaiting administrative approval. Public shoppers continue to see the approved active listing on the WIZZ.PK storefront until this revision is approved.
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
        {[
          { id: "general", label: "Basic Details & Category", icon: Tag },
          { id: "images", label: `Media Gallery (${images.length})`, icon: ImageIcon },
          { id: "variants", label: `Variants & Stock (${variants.length})`, icon: Boxes },
          { id: "attributes", label: `Attributes (${attributes.length})`, icon: Layers },
          { id: "seo", label: "SEO & Search Preview", icon: Globe },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================== */}
      {/* TAB 1: General Details & Category */}
      {/* ==================================================== */}
      {activeTab === "general" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
              <h2 className="text-sm font-bold text-slate-900">Product Title & Description</h2>

              <Input
                label="Product Title"
                required
                placeholder="e.g. Wireless Noise-Cancelling Headphones Pro"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
              />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder="Detail the specifications, materials, features, and key selling points..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Formatting tip: Clear bullet points and benefit summaries boost conversion on WIZZ.PK.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
              <h2 className="text-sm font-bold text-slate-900">Dimensions & Package Weight</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Input
                  label="Weight (grams)"
                  type="number"
                  min={1}
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(parseInt(e.target.value, 10) || 500)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
              <h2 className="text-sm font-bold text-slate-900">Catalog Organization</h2>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Storefront Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Brand (Optional)</label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Independent Merchant Brand --</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: Multiple Images Management */}
      {/* ==================================================== */}
      {activeTab === "images" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Product Photography & Media</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload multiple clean images. Select primary thumbnail, reorder sequence, and provide alt text.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm">
                  <UploadCloud size={14} />
                  <span>{isUploadingImage ? "Uploading..." : "Upload From Device"}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploadingImage}
                  />
                </label>
              </div>
            </div>

            {/* Quick URL entry */}
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="Or paste direct image URL (https://...)"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="flex-1 text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <Button type="button" size="sm" onClick={handleAddImageUrl} variant="secondary">
                <Plus size={14} />
                <span>Add URL</span>
              </Button>
            </div>

            {/* Image Grid */}
            {images.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-2">
                <ImageIcon className="mx-auto text-slate-300" size={40} />
                <p className="text-xs font-bold text-slate-700">No images added yet</p>
                <p className="text-[11px] text-slate-400">
                  Upload crisp photos showing front, back, and packaging. WIZZ.PK displays high-resolution thumbnails.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`bg-slate-50 rounded-2xl border p-3 space-y-3 relative transition-all ${
                      img.isThumbnail ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200"
                    }`}
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-white border border-slate-100 flex items-center justify-center">
                      <img src={img.url} alt={img.altText} className="object-cover w-full h-full" />
                      {img.isThumbnail && (
                        <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm">
                          Primary
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Alt description for SEO"
                        value={img.altText}
                        onChange={(e) => handleUpdateImageAlt(idx, e.target.value)}
                        className="w-full text-[11px] rounded-lg border border-slate-200 p-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60 text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveImage(idx, "up")}
                          disabled={idx === 0}
                          className="p-1 rounded text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          title="Move earlier"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveImage(idx, "down")}
                          disabled={idx === images.length - 1}
                          className="p-1 rounded text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          title="Move later"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {!img.isThumbnail && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryImage(idx)}
                            className="text-[10px] font-bold text-slate-600 hover:text-emerald-700 px-1.5 py-0.5 rounded hover:bg-slate-200"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          title="Remove image"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: Variants, Combinations, SKU, Price & Stock */}
      {/* ==================================================== */}
      {activeTab === "variants" && (
        <div className="space-y-6">
          {/* Matrix Generator Tool */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Variant Matrix Generator</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define attributes (e.g. Size, Color) with comma-separated values to automatically build all combinations.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleAddOptionDef} className="text-xs">
                  <Plus size={13} />
                  <span>Add Option</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerateMatrix}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Sparkles size={13} />
                  <span>Generate Matrix</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {optionDefs.map((def, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 relative">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Option Name (e.g. Size)"
                      value={def.name}
                      onChange={(e) => handleOptionNameChange(idx, e.target.value)}
                      className="text-xs font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none"
                    />
                    {optionDefs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOptionDef(idx)}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Comma-separated (S, M, L, XL)"
                    defaultValue={def.values.join(", ")}
                    onBlur={(e) => handleOptionValuesChange(idx, e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bulk Update Bar */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 font-bold">
              <Boxes size={16} className="text-emerald-400" />
              <span>Bulk Action on All {variants.length} Variants:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                placeholder="Set Price (PKR)"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                className="w-32 text-xs rounded-xl border border-slate-700 bg-slate-800 text-white p-2 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <input
                type="number"
                placeholder="Set Compare-At (PKR)"
                value={bulkCompareAt}
                onChange={(e) => setBulkCompareAt(e.target.value)}
                className="w-36 text-xs rounded-xl border border-slate-700 bg-slate-800 text-white p-2 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <input
                type="number"
                placeholder="Set Stock"
                value={bulkStock}
                onChange={(e) => setBulkStock(e.target.value)}
                className="w-24 text-xs rounded-xl border border-slate-700 bg-slate-800 text-white p-2 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <Button type="button" size="sm" onClick={handleApplyBulk} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold">
                Apply Bulk
              </Button>
            </div>
          </div>

          {/* Variant Rows Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Active Variants ({variants.length})</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every variant must have a unique SKU and non-negative stock.
                </p>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={handleAddSingleVariant} className="text-xs">
                <Plus size={13} />
                <span>Add Single Variant</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="py-3 px-4">Variant Title</th>
                    <th className="py-3 px-4">SKU Code</th>
                    <th className="py-3 px-4">Selling Price (Rs.)</th>
                    <th className="py-3 px-4">Original Compare-At (Rs.)</th>
                    <th className="py-3 px-4">Stock Units</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {variants.map((v, idx) => {
                    const isPromoInvalid =
                      v.compareAtPricePkr !== "" &&
                      Number(v.compareAtPricePkr) <= Number(v.pricePkr);
                    const isStockInvalid = v.stock < 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={v.title}
                            onChange={(e) => handleVariantChange(idx, "title", e.target.value)}
                            className="w-full text-xs font-semibold rounded-lg border border-slate-200 p-1.5 bg-white"
                          />
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <input
                            type="text"
                            value={v.sku}
                            onChange={(e) => handleVariantChange(idx, "sku", e.target.value)}
                            className="w-full text-xs font-mono rounded-lg border border-slate-200 p-1.5 bg-white"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min={0}
                            value={v.pricePkr}
                            onChange={(e) =>
                              handleVariantChange(idx, "pricePkr", parseFloat(e.target.value) || 0)
                            }
                            className="w-28 text-xs font-bold rounded-lg border border-slate-200 p-1.5 bg-white text-emerald-700"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <input
                              type="number"
                              placeholder="Optional promo"
                              value={v.compareAtPricePkr}
                              onChange={(e) =>
                                handleVariantChange(
                                  idx,
                                  "compareAtPricePkr",
                                  e.target.value === "" ? "" : parseFloat(e.target.value)
                                )
                              }
                              className={`w-32 text-xs rounded-lg border p-1.5 bg-white ${
                                isPromoInvalid ? "border-rose-500 bg-rose-50 text-rose-900" : "border-slate-200"
                              }`}
                            />
                            {isPromoInvalid && (
                              <p className="text-[10px] text-rose-600 font-semibold">
                                Must be &gt; Rs. {v.pricePkr}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min={0}
                            value={v.stock}
                            onChange={(e) =>
                              handleVariantChange(idx, "stock", parseInt(e.target.value, 10) || 0)
                            }
                            className={`w-24 text-xs font-bold rounded-lg border p-1.5 bg-white ${
                              isStockInvalid ? "border-rose-500 bg-rose-50" : "border-slate-200"
                            }`}
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete variant"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: Attributes & Specifications */}
      {/* ==================================================== */}
      {activeTab === "attributes" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Custom Specifications & Attributes</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Key-value attributes are rendered in the product specification table on the storefront.
              </p>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={() => handleAddAttribute()} className="text-xs">
              <Plus size={13} />
              <span>Add Custom Attribute</span>
            </Button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Quick suggestions:</span>
            {["Material", "Warranty", "Color", "Dimensions", "Made In", "Weight", "Battery Life"].map(
              (preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAddAttribute(preset, "")}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors"
                >
                  + {preset}
                </button>
              )
            )}
          </div>

          <div className="space-y-3 pt-2">
            {attributes.map((attr, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Attribute name (e.g. Material)"
                  value={attr.key}
                  onChange={(e) => handleAttributeChange(idx, e.target.value, attr.value)}
                  className="w-1/3 text-xs rounded-xl border border-slate-300 p-2.5 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  placeholder="Attribute value (e.g. 100% Genuine Leather)"
                  value={attr.value}
                  onChange={(e) => handleAttributeChange(idx, attr.key, e.target.value)}
                  className="flex-1 text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveAttribute(idx)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 5: Search Engine Optimization (SEO) & Preview */}
      {/* ==================================================== */}
      {activeTab === "seo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-slate-900">Search Engine Metadata</h2>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">Meta Title</label>
                <span className={`text-[10px] font-mono ${metaTitle.length > 60 ? "text-amber-600 font-bold" : "text-slate-400"}`}>
                  {metaTitle.length}/60 chars
                </span>
              </div>
              <input
                type="text"
                placeholder={title || "Title for search engines..."}
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">Meta Description</label>
                <span className={`text-[10px] font-mono ${metaDescription.length > 160 ? "text-amber-600 font-bold" : "text-slate-400"}`}>
                  {metaDescription.length}/160 chars
                </span>
              </div>
              <textarea
                rows={3}
                placeholder={description.slice(0, 150) || "Description for search engine snippets..."}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">URL Slug</label>
              <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-500">
                <span>wizz.pk/products/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="bg-transparent text-slate-900 font-bold focus:outline-none flex-1 ml-1"
                />
              </div>
            </div>
          </div>

          {/* Google Search SERP Preview Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <GoogleIcon />
              <span>Google Search Result Preview</span>
            </h2>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1 font-sans">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="font-semibold text-slate-800">https://wizz.pk</span>
                <span>&rsaquo; products &rsaquo; {slug || "product-slug"}</span>
              </div>
              <h3 className="text-sm sm:text-base font-medium text-blue-800 hover:underline cursor-pointer truncate">
                {metaTitle || title || "Product Title | WIZZ.PK"}
              </h3>
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {metaDescription || description || "Order genuine physical merchandise across Pakistan with fast courier delivery and Cash on Delivery at WIZZ.PK."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* Interactive Storefront Preview Modal */}
      {/* ==================================================== */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-800">
                  Storefront Live Customer Preview
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Photo showcase */}
                <div className="space-y-3">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                    {primaryImage ? (
                      <img
                        src={primaryImage.url}
                        alt={primaryImage.altText}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <ImageIcon className="text-slate-300" size={60} />
                    )}
                  </div>
                  {images.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto">
                      {images.map((img, i) => (
                        <div
                          key={i}
                          className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0"
                        >
                          <img src={img.url} alt={img.altText} className="object-cover w-full h-full" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
                    Verified Merchant Listing
                  </span>

                  <h2 className="text-xl font-black text-slate-900 leading-tight">
                    {title || "Untitled Product"}
                  </h2>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">
                      {formatPkr(Math.round((variants[0]?.pricePkr || 2499) * 100))}
                    </span>
                    {variants[0]?.compareAtPricePkr && (
                      <span className="text-sm font-semibold text-slate-400 line-through">
                        {formatPkr(Math.round(Number(variants[0].compareAtPricePkr) * 100))}
                      </span>
                    )}
                  </div>

                  {/* Variant Selection Mock */}
                  {variants.length > 1 && (
                    <div className="space-y-1.5 pt-2">
                      <label className="text-xs font-bold text-slate-700">Choose Option:</label>
                      <div className="flex flex-wrap gap-2">
                        {variants.map((v, i) => (
                          <span
                            key={i}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${
                              i === 0
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            {v.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button size="lg" className="w-full shadow-lg shadow-emerald-600/20" disabled>
                      <span>Add to Bag (Preview Only)</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Description preview */}
              <div className="border-t border-slate-100 pt-6 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Product Overview</h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {description || "No description provided."}
                </p>
              </div>

              {/* Attributes Table */}
              {attributes.length > 0 && (
                <div className="border-t border-slate-100 pt-6 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">Specifications</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {attributes.map((a, i) => (
                      <div key={i} className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="font-semibold text-slate-500">{a.key}</span>
                        <span className="font-bold text-slate-900">{a.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button type="button" size="sm" onClick={() => setIsPreviewOpen(false)}>
                Back to Editing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
