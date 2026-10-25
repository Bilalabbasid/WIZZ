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
import { ProductDescription } from "@/components/product-description";

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
  /** On-hand stock when loaded; the server applies edits as a delta from it. */
  stockBaseline?: number;
  reservedUnits?: number;
  lowStockThreshold: number;
  attributes: Record<string, string>;
  isActive: boolean;
  dealPricePkr: number | "";
  /** datetime-local values (seller's local time) */
  dealStartsAt: string;
  dealEndsAt: string;
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
  /** Set after creating a listing, to confirm what happened */
  createdNotice?: "draft" | "submitted";
}

/** Date -> value for <input type="datetime-local"> in the browser's timezone. */
function toLocalInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function dealState(v: Pick<ProductVariantItem, "dealPricePkr" | "dealStartsAt" | "dealEndsAt">, now: number) {
  if (v.dealPricePkr === "" || !v.dealStartsAt || !v.dealEndsAt) return "none" as const;
  const start = new Date(v.dealStartsAt).getTime();
  const end = new Date(v.dealEndsAt).getTime();
  if (end <= now) return "ended" as const;
  return start <= now ? ("live" as const) : ("scheduled" as const);
}

const comboKey = (attrs: Record<string, string>) =>
  Object.entries(attrs)
    .map(([k, v]) => `${k.trim().toLowerCase()}=${String(v).trim().toLowerCase()}`)
    .sort()
    .join("|");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function variantFromServer(v: any): ProductVariantItem {
  let parsedAttrs: Record<string, string> = {};
  try {
    parsedAttrs = JSON.parse(v.attributesJson || "{}");
  } catch {}
  // While a deal is live the server stores the regular price in dealRegular*
  const regularPrice = v.dealRegularPriceMinor ?? v.priceMinor;
  const regularCompareAt = v.dealRegularPriceMinor != null ? v.dealRegularCompareAtMinor : v.compareAtPriceMinor;
  return {
    id: v.id,
    title: v.title,
    sku: v.sku,
    pricePkr: regularPrice / 100,
    compareAtPricePkr: regularCompareAt ? regularCompareAt / 100 : "",
    costPricePkr: v.costPriceMinor ? v.costPriceMinor / 100 : "",
    barcode: v.barcode || "",
    stock: v.inventoryLevel?.availableUnits ?? 0,
    stockBaseline: v.inventoryLevel?.availableUnits ?? 0,
    reservedUnits: v.inventoryLevel?.reservedUnits ?? 0,
    lowStockThreshold: v.inventoryLevel?.lowStockThreshold ?? 5,
    attributes: parsedAttrs,
    isActive: v.isActive,
    dealPricePkr: v.dealPriceMinor ? v.dealPriceMinor / 100 : "",
    dealStartsAt: toLocalInput(v.dealStartsAt),
    dealEndsAt: toLocalInput(v.dealEndsAt),
  };
}

const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function SellerProductEditor({ initialProductId, createdNotice }: SellerProductEditorProps) {
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
  const [isApprovedListing, setIsApprovedListing] = useState<boolean>(false);
  const [isFirstPartyStore, setIsFirstPartyStore] = useState<boolean>(false);
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
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
      dealPricePkr: "",
      dealStartsAt: "",
      dealEndsAt: "",
    },
  ]);

  // Bulk actions state
  const [bulkPrice, setBulkPrice] = useState<string>("");
  const [bulkStock, setBulkStock] = useState<string>("");
  const [bulkCompareAt, setBulkCompareAt] = useState<string>("");
  const [bulkDealPercent, setBulkDealPercent] = useState<string>("");
  const [bulkDealStart, setBulkDealStart] = useState<string>("");
  const [bulkDealEnd, setBulkDealEnd] = useState<string>("");

  // UI state
  const [activeTab, setActiveTab] = useState<"general" | "images" | "variants" | "attributes" | "seo">("general");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(initialProductId));
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(
    createdNotice === "submitted"
      ? "Listing created and sent for review."
      : createdNotice === "draft"
      ? "Draft created. Add photos and details, then submit it."
      : null
  );
  // Reference time for deal badges, captured once per editor session
  const [nowTs] = useState(() => Date.now());
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
        if (ctxData.context) {
          setCanSell(ctxData.context.canSell);
          const org = ctxData.context.sellerOrg;
          // Display hint only; the server decides whether review is needed
          setIsFirstPartyStore(Boolean(org && (org.slug === "wizz-pk-direct" || org.id === "seller_wizz_pk_1p")));
        }

        if (prodData && prodData.error) {
          setErrorMessage(prodData.error);
        }
        if (prodData && prodData.product) {
          const p = prodData.product;
          setIsApprovedListing(Boolean(p.isApprovedByPlatform));
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

          // Populate variants (inactive ones were removed earlier and are not editable)
          if (p.variants && p.variants.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const active = p.variants.filter((v: any) => v.isActive);
            setVariants((active.length ? active : p.variants).map(variantFromServer));
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
    const url = newImageUrl.trim();
    if (!url) return;
    if (!/^https:\/\/[^\s"'<>]+$/i.test(url)) {
      setErrorMessage("Image links must start with https://");
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setErrorMessage(`A product can have at most ${MAX_IMAGES} images.`);
      return;
    }
    const newImg: ProductImageItem = {
      url,
      altText: title || "Product image",
      isThumbnail: images.length === 0,
      displayOrder: images.length,
    };
    setImages([...images, newImg]);
    setNewImageUrl("");
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setErrorMessage(`A product can have at most ${MAX_IMAGES} images. Remove one to add another.`);
      return;
    }

    const problems: string[] = [];
    const accepted = files.filter((file) => {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        problems.push(`${file.name}: use a JPEG, PNG, WEBP or GIF image.`);
        return false;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        problems.push(`${file.name}: larger than 10 MB.`);
        return false;
      }
      return true;
    });
    if (accepted.length > room) {
      problems.push(`Only ${room} more image(s) fit; the rest were skipped.`);
      accepted.length = room;
    }

    setIsUploadingImage(true);
    setErrorMessage(null);

    for (const file of accepted) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "product_image");

      try {
        const res = await fetch("/api/uploads", { method: "POST", body: formData });
        const data = await res.json();
        if (res.ok && data.url) {
          setImages((prev) => [
            ...prev,
            {
              url: data.url,
              altText: title || file.name.replace(/\.[^/.]+$/, ""),
              isThumbnail: prev.length === 0,
              displayOrder: prev.length,
            },
          ]);
        } else {
          problems.push(`${file.name}: ${data.error || "upload failed."}`);
        }
      } catch {
        problems.push(`${file.name}: upload failed. Check your connection and try again.`);
      }
    }

    setIsUploadingImage(false);
    if (problems.length) setErrorMessage(problems.join(" "));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (input.files) await uploadFiles(input.files);
    input.value = ""; // allow re-selecting the same file
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

    // Keep existing variants whose options match a combination (their id, price,
    // stock and deal are preserved); only genuinely new combinations are added.
    const existingByCombo = new Map(variants.map((v) => [comboKey(v.attributes), v]));
    const basePrice = variants[0]?.pricePkr || 2499;
    const baseSkuPrefix = (title.replace(/[^A-Za-z0-9]/g, "").slice(0, 4) || "WIZ").toUpperCase();
    const usedSkus = new Set(variants.map((v) => v.sku.toUpperCase()));

    const newVariants: ProductVariantItem[] = combinations.map((combo, idx) => {
      const match = existingByCombo.get(comboKey(combo));
      if (match) return { ...match, attributes: combo, title: Object.values(combo).join(" / ") };

      const comboSkuSuffix = Object.values(combo)
        .map((v) => v.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "X")
        .join("-");
      let sku = `${baseSkuPrefix}-${comboSkuSuffix}`;
      for (let n = idx + 1; usedSkus.has(sku.toUpperCase()); n++) sku = `${baseSkuPrefix}-${comboSkuSuffix}-${n}`;
      usedSkus.add(sku.toUpperCase());

      return {
        title: Object.values(combo).join(" / "),
        sku,
        pricePkr: basePrice,
        compareAtPricePkr: "",
        stock: 0,
        lowStockThreshold: 5,
        attributes: combo,
        isActive: true,
        dealPricePkr: "",
        dealStartsAt: "",
        dealEndsAt: "",
      };
    });

    const dropped = variants.filter((v) => v.id && !newVariants.some((nv) => nv.id === v.id)).length;
    setVariants(newVariants);
    setSaveMessage(null);
    setErrorMessage(
      dropped > 0
        ? `${dropped} saved variant(s) no longer match your options. They will stop selling when you save; order history is kept.`
        : null
    );
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
        stock: 0,
        lowStockThreshold: 5,
        attributes: {},
        isActive: true,
        dealPricePkr: "",
        dealStartsAt: "",
        dealEndsAt: "",
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

  /** Applies a "% off" deal with one schedule to every variant. */
  const handleApplyBulkDeal = () => {
    const pct = Number(bulkDealPercent);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
      setErrorMessage("Enter a deal discount between 1 and 99 percent.");
      return;
    }
    if (!bulkDealStart || !bulkDealEnd) {
      setErrorMessage("Choose when the deal starts and ends.");
      return;
    }
    if (new Date(bulkDealEnd) <= new Date(bulkDealStart)) {
      setErrorMessage("The deal must end after it starts.");
      return;
    }
    setErrorMessage(null);
    setVariants(
      variants.map((v) => ({
        ...v,
        dealPricePkr: Math.max(1, Math.round(v.pricePkr * (1 - pct / 100))),
        dealStartsAt: bulkDealStart,
        dealEndsAt: bulkDealEnd,
      }))
    );
    setBulkDealPercent("");
  };

  const handleClearDeals = () => {
    setVariants(variants.map((v) => ({ ...v, dealPricePkr: "", dealStartsAt: "", dealEndsAt: "" })));
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

      if (!v.title.trim()) return `Variant #${i + 1} needs a name.`;
      if (!(v.pricePkr > 0)) return `Variant "${v.sku}": price must be greater than zero.`;
      if (v.stock < 0) return `Variant "${v.sku}" stock cannot be negative.`;
      if ((v.reservedUnits ?? 0) > 0 && v.stock < (v.reservedUnits ?? 0)) {
        return `Variant "${v.sku}": stock cannot go below the ${v.reservedUnits} unit(s) held for open checkouts.`;
      }

      if (v.compareAtPricePkr !== "" && Number(v.compareAtPricePkr) <= Number(v.pricePkr)) {
        return `Variant "${v.sku}": "Was" price (Rs. ${v.compareAtPricePkr}) must be higher than the selling price (Rs. ${v.pricePkr}).`;
      }

      const hasAnyDeal = v.dealPricePkr !== "" || v.dealStartsAt || v.dealEndsAt;
      if (hasAnyDeal) {
        if (v.dealPricePkr === "" || !v.dealStartsAt || !v.dealEndsAt) {
          return `Variant "${v.sku}": a deal needs a deal price, a start and an end.`;
        }
        if (!(Number(v.dealPricePkr) > 0) || Number(v.dealPricePkr) >= v.pricePkr) {
          return `Variant "${v.sku}": deal price must be lower than the regular price (Rs. ${v.pricePkr}).`;
        }
        if (new Date(v.dealEndsAt) <= new Date(v.dealStartsAt)) {
          return `Variant "${v.sku}": the deal must end after it starts.`;
        }
      }
    }

    if (!isDraft && images.length === 0) {
      return "Please add at least one product image before publishing.";
    }

    return null;
  };

  /**
   * save:    store changes (prices, stock and deals go live; content of an approved
   *          listing is sent for review)
   * submit:  save and publish (first-party) or send for platform review
   * offline / online: take an approved listing off the store, or put it back
   */
  const handleSave = async (mode: "save" | "submit" | "offline" | "online" = "save") => {
    setErrorMessage(null);
    setSaveMessage(null);

    const validationErr = validateBeforeSubmit(mode !== "submit");
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    setIsSaving(true);

    try {
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
        submitForReview: mode === "submit",
        ...(mode === "offline" ? { status: "DRAFT" } : mode === "online" ? { status: "PUBLISHED" } : {}),
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
          // Existing variants: desired stock + what was loaded (applied as a delta).
          // New variants: opening stock.
          ...(v.id
            ? { availableUnits: Math.max(0, Math.floor(v.stock)), stockBaseline: v.stockBaseline }
            : initialProductId
            ? { availableUnits: Math.max(0, Math.floor(v.stock)) }
            : { initialStock: Math.max(0, Math.floor(v.stock)) }),
          lowStockThreshold: Math.max(0, Math.floor(v.lowStockThreshold)),
          dealPriceMinor: v.dealPricePkr !== "" ? Math.round(Number(v.dealPricePkr) * 100) : null,
          dealStartsAt: localInputToIso(v.dealStartsAt),
          dealEndsAt: localInputToIso(v.dealEndsAt),
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

      if (!initialProductId && data.product?.id) {
        router.push(`/seller/portal/products/${data.product.id}?created=${mode === "submit" ? "submitted" : "draft"}`);
        return;
      }

      const p = data.product;
      if (p) {
        setStatus(p.status);
        setModerationStatus(p.moderationStatus || "DRAFT");
        setModerationNotes(p.moderationNotes || null);
        setHasPendingChanges(Boolean(p.pendingChangesJson));
        setIsApprovedListing(Boolean(p.isApprovedByPlatform));
        if (!p.pendingChangesJson && p.variants?.length) {
          // Re-sync with the server: new variant ids, stock baselines, deal state
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setVariants(p.variants.filter((v: any) => v.isActive).map(variantFromServer));
        } else if (p.variants?.length) {
          // Content is in review: keep the seller's edits on screen, refresh stock baselines
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const byId = new Map<string, any>(p.variants.map((v: any) => [v.id, v]));
          setVariants((prev) =>
            prev.map((v) => {
              const fresh = v.id ? byId.get(v.id) : undefined;
              return fresh
                ? {
                    ...v,
                    stock: fresh.inventoryLevel?.availableUnits ?? v.stock,
                    stockBaseline: fresh.inventoryLevel?.availableUnits ?? v.stockBaseline,
                    reservedUnits: fresh.inventoryLevel?.reservedUnits ?? v.reservedUnits,
                  }
                : v;
            })
          );
        }

        const contentInReview = Boolean(p.pendingChangesJson);
        let message: string;
        if (mode === "offline") message = "Listing taken offline. Shoppers can no longer see or buy it.";
        else if (mode === "online") message = "Listing is back on the store.";
        else if (contentInReview)
          message = "Saved. Price, stock and deal changes are live; content changes are waiting for WIZZ.PK review.";
        else if (p.moderationStatus === "PENDING_REVIEW")
          message = "Submitted for review. WIZZ.PK checks new listings before they go live.";
        else if (p.status === "PUBLISHED") message = "Saved. Your changes are live on the store.";
        else message = "Draft saved.";
        setSaveMessage(message);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm sticky top-[124px] z-20">
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
              {/* Listing status */}
              <Badge
                variant={
                  status === "PUBLISHED"
                    ? "success"
                    : moderationStatus === "REJECTED"
                    ? "danger"
                    : moderationStatus === "PENDING_REVIEW" || moderationStatus === "CHANGES_REQUESTED"
                    ? "warning"
                    : "neutral"
                }
                className="text-[11px] font-bold whitespace-nowrap"
              >
                {status === "PUBLISHED"
                  ? "Live on store"
                  : status === "ARCHIVED"
                  ? "Archived"
                  : isApprovedListing
                  ? "Offline"
                  : moderationStatus === "PENDING_REVIEW"
                  ? "In review"
                  : moderationStatus === "CHANGES_REQUESTED"
                  ? "Changes requested"
                  : moderationStatus === "REJECTED"
                  ? "Rejected"
                  : "Draft"}
              </Badge>
              {hasPendingChanges && moderationStatus === "PENDING_REVIEW" && (
                <Badge variant="warning" className="text-[11px] font-bold whitespace-nowrap">
                  Edits in review
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {variants.length} variant{variants.length === 1 ? "" : "s"}, {images.length} photo{images.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewOpen(true)}
            className="text-xs"
          >
            <Eye size={14} />
            <span>Preview</span>
          </Button>

          {isApprovedListing && status === "PUBLISHED" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSave("offline")}
              disabled={isSaving}
              className="text-xs"
            >
              <span>Take offline</span>
            </Button>
          )}
          {isApprovedListing && status === "DRAFT" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSave("online")}
              disabled={isSaving || !canSell}
              className="text-xs"
            >
              <span>Put back online</span>
            </Button>
          )}

          <Button
            type="button"
            variant={isApprovedListing ? "primary" : "secondary"}
            size="sm"
            onClick={() => handleSave("save")}
            isLoading={isSaving}
            disabled={isSaving}
            className="text-xs font-semibold"
          >
            <Save size={14} />
            <span>{isApprovedListing ? "Save changes" : "Save draft"}</span>
          </Button>

          {!isApprovedListing && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleSave("submit")}
              isLoading={isSaving}
              disabled={isSaving || !canSell}
              title={canSell ? undefined : "Your store must be approved before listings can go live."}
              className="text-xs font-bold"
            >
              <Send size={14} />
              <span>
                {isFirstPartyStore
                  ? "Publish"
                  : moderationStatus === "CHANGES_REQUESTED" || moderationStatus === "REJECTED"
                  ? "Resubmit for review"
                  : moderationStatus === "PENDING_REVIEW"
                  ? "Update submission"
                  : "Submit for review"}
              </span>
            </Button>
          )}
          {isApprovedListing && moderationStatus === "CHANGES_REQUESTED" && hasPendingChanges && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleSave("submit")}
              isLoading={isSaving}
              disabled={isSaving}
              className="text-xs font-bold"
            >
              <Send size={14} />
              <span>Resubmit edits</span>
            </Button>
          )}
        </div>
      </div>

      {/* How saving works for this listing */}
      {isApprovedListing && !isFirstPartyStore && (
        <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <strong className="text-slate-900">Price, stock and deal changes go live as soon as you save.</strong>{" "}
          Changes to the title, description, photos, category, specifications or new variants are checked by WIZZ.PK first;
          shoppers keep seeing the current version until they are approved.
        </p>
      )}
      {!canSell && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          You can prepare drafts now. Listings can be submitted once your store is approved.
        </p>
      )}

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
            Make the requested corrections below, then choose <strong>{isApprovedListing ? "Resubmit edits" : "Resubmit for review"}</strong>.
          </p>
        </div>
      )}

      {/* Staged Revisions Banner for Published Products */}
      {hasPendingChanges && moderationStatus === "PENDING_REVIEW" && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex items-start gap-3 text-xs">
          <HelpCircle size={16} className="text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Content edits waiting for review</p>
            <p className="text-slate-600 leading-relaxed">
              Shoppers see the approved version until WIZZ.PK approves these edits. Saving again replaces the edits in review.
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
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="product-description" className="block text-xs font-bold text-slate-700">
                    Product Description <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex rounded-lg border border-slate-200 p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setShowDescriptionPreview(false)}
                      aria-pressed={!showDescriptionPreview}
                      className={`px-2.5 py-1 rounded-md ${!showDescriptionPreview ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDescriptionPreview(true)}
                      aria-pressed={showDescriptionPreview}
                      className={`px-2.5 py-1 rounded-md ${showDescriptionPreview ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      Preview
                    </button>
                  </div>
                </div>
                {showDescriptionPreview ? (
                  <div className="min-h-[180px] rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                    <ProductDescription text={description} />
                  </div>
                ) : (
                  <textarea
                    id="product-description"
                    rows={10}
                    maxLength={20000}
                    placeholder={"What it is and who it's for.\n\n## Key features\n- Feature one\n- Feature two\n\n## In the box\n- Item"}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 p-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
                  />
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-1 text-[11px] text-slate-500">
                  <span>
                    Formatting: blank line for a new paragraph, <code className="font-mono">## </code>for a heading,{" "}
                    <code className="font-mono">- </code>for a bullet, <code className="font-mono">**bold**</code>.
                  </span>
                  <span className="tabular-nums">{description.length.toLocaleString()} / 20,000</span>
                </div>
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
                  Up to {MAX_IMAGES} JPEG, PNG, WEBP or GIF images, 10 MB each. The primary image is shown in search
                  results; square photos on a plain background work best.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm">
                  <UploadCloud size={14} />
                  <span>{isUploadingImage ? "Uploading..." : `Upload photos (${images.length}/${MAX_IMAGES})`}</span>
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
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
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFiles(true);
              }}
              onDragLeave={() => setIsDraggingFiles(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFiles(false);
                if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
              }}
              className={`rounded-3xl transition-colors ${isDraggingFiles ? "ring-2 ring-emerald-500 bg-emerald-50/40" : ""}`}
            >
            {images.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-2">
                <ImageIcon className="mx-auto text-slate-300" size={40} />
                <p className="text-xs font-bold text-slate-700">Drag photos here, or use Upload photos</p>
                <p className="text-[11px] text-slate-500">
                  Show the front, back, details and packaging. At least one photo is needed to submit.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                          aria-label="Move image earlier"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveImage(idx, "down")}
                          disabled={idx === images.length - 1}
                          className="p-1 rounded text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          title="Move later"
                          aria-label="Move image later"
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
                          aria-label="Remove image"
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

          {/* Deal scheduler (special price for a time window) */}
          <div className="bg-white border border-orange-200 p-4 rounded-2xl space-y-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Tag size={14} className="text-orange-600" />
                  <span>Run a deal</span>
                </p>
                <p className="text-slate-500 mt-0.5">
                  A deal sells at a lower price between the start and end time, then returns to the regular price
                  automatically. Shoppers see the regular price struck through and the product appears in Deals.
                </p>
              </div>
              {variants.some((v) => v.dealPricePkr !== "") && (
                <button type="button" onClick={handleClearDeals} className="text-rose-600 font-semibold hover:underline">
                  Remove all deals
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="block font-semibold text-slate-700">Discount %</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  placeholder="e.g. 15"
                  value={bulkDealPercent}
                  onChange={(e) => setBulkDealPercent(e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 p-2 bg-white"
                />
              </label>
              <label className="space-y-1">
                <span className="block font-semibold text-slate-700">Starts</span>
                <input
                  type="datetime-local"
                  value={bulkDealStart}
                  onChange={(e) => setBulkDealStart(e.target.value)}
                  className="rounded-lg border border-slate-300 p-2 bg-white"
                />
              </label>
              <label className="space-y-1">
                <span className="block font-semibold text-slate-700">Ends</span>
                <input
                  type="datetime-local"
                  value={bulkDealEnd}
                  onChange={(e) => setBulkDealEnd(e.target.value)}
                  className="rounded-lg border border-slate-300 p-2 bg-white"
                />
              </label>
              <Button type="button" size="sm" variant="accent" onClick={handleApplyBulkDeal}>
                Apply to all variants
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              Or set a deal per variant in the table below. Deal changes are saved with the listing and go live without review.
            </p>
          </div>

          {/* Variant Rows Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Active Variants ({variants.length})</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Each variant needs a unique SKU. Removed variants stop selling when you save; past orders keep their details.
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
                    <th className="py-3 px-4">Price (Rs.)</th>
                    <th className="py-3 px-4">&ldquo;Was&rdquo; price (Rs.)</th>
                    <th className="py-3 px-4">Deal</th>
                    <th className="py-3 px-4">Stock</th>
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
                            min={1}
                            step="any"
                            aria-label={`Price for ${v.title}`}
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
                              placeholder="Optional"
                              aria-label={`Was price for ${v.title}`}
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
                        <td className="py-3 px-4 align-top">
                          {(() => {
                            const state = dealState(v, nowTs);
                            const dealInvalid =
                              v.dealPricePkr !== "" && Number(v.dealPricePkr) >= Number(v.pricePkr);
                            return (
                              <div className="space-y-1 min-w-[190px]">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min={1}
                                    step="any"
                                    placeholder="Deal price"
                                    aria-label={`Deal price for ${v.title}`}
                                    value={v.dealPricePkr}
                                    onChange={(e) =>
                                      handleVariantChange(
                                        idx,
                                        "dealPricePkr",
                                        e.target.value === "" ? "" : parseFloat(e.target.value)
                                      )
                                    }
                                    className={`w-24 text-xs rounded-lg border p-1.5 bg-white ${
                                      dealInvalid ? "border-rose-500 bg-rose-50" : "border-slate-200"
                                    }`}
                                  />
                                  {state === "live" && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">Live</span>
                                  )}
                                  {state === "scheduled" && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">Scheduled</span>
                                  )}
                                  {state === "ended" && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Ended</span>
                                  )}
                                </div>
                                {v.dealPricePkr !== "" && (
                                  <>
                                    <input
                                      type="datetime-local"
                                      aria-label={`Deal start for ${v.title}`}
                                      value={v.dealStartsAt}
                                      onChange={(e) => handleVariantChange(idx, "dealStartsAt", e.target.value)}
                                      className="w-full text-[11px] rounded-lg border border-slate-200 p-1 bg-white"
                                    />
                                    <input
                                      type="datetime-local"
                                      aria-label={`Deal end for ${v.title}`}
                                      value={v.dealEndsAt}
                                      onChange={(e) => handleVariantChange(idx, "dealEndsAt", e.target.value)}
                                      className="w-full text-[11px] rounded-lg border border-slate-200 p-1 bg-white"
                                    />
                                  </>
                                )}
                                {dealInvalid && (
                                  <p className="text-[10px] text-rose-600 font-semibold">Must be below Rs. {v.pricePkr}</p>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="space-y-1">
                            <input
                              type="number"
                              min={0}
                              aria-label={`Stock for ${v.title}`}
                              value={v.stock}
                              onChange={(e) =>
                                handleVariantChange(idx, "stock", parseInt(e.target.value, 10) || 0)
                              }
                              className={`w-24 text-xs font-bold rounded-lg border p-1.5 bg-white ${
                                isStockInvalid ? "border-rose-500 bg-rose-50" : "border-slate-200"
                              }`}
                            />
                            {(v.reservedUnits ?? 0) > 0 && (
                              <p className="text-[10px] text-slate-500">{v.reservedUnits} held in checkouts</p>
                            )}
                            <label className="flex items-center gap-1 text-[10px] text-slate-500">
                              <span>Alert at</span>
                              <input
                                type="number"
                                min={0}
                                aria-label={`Low stock alert level for ${v.title}`}
                                value={v.lowStockThreshold}
                                onChange={(e) =>
                                  handleVariantChange(idx, "lowStockThreshold", Math.max(0, parseInt(e.target.value, 10) || 0))
                                }
                                className="w-12 rounded border border-slate-200 p-0.5 bg-white"
                              />
                            </label>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Remove variant"
                            aria-label={`Remove variant ${v.title}`}
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
                <ProductDescription text={description} className="text-xs" />
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
