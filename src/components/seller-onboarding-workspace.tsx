"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Upload,
  ArrowRight,
  Clock,
  Sparkles,
  ShieldCheck,
  Building2,
  FileText,
} from "lucide-react";

export interface ApplicationData {
  id?: string;
  legalBusinessName: string;
  tradingName: string;
  businessRegNumber?: string | null;
  taxVatNumber?: string | null;
  countryCode: string;
  city: string;
  addressLine: string;
  websiteUrl?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  bankName?: string | null;
  bankAccountTitle?: string | null;
  bankIban?: string | null;
  notes?: string | null;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED";
  reviewerFeedback?: string | null;
  approvedOrgId?: string | null;
  events?: Array<{
    id: string;
    fromStatus?: string | null;
    toStatus: string;
    note?: string | null;
    createdAt: Date | string;
  }>;
  documents?: Array<{
    id: string;
    originalFilename: string;
    documentType: string;
    fileSizeBytes: number;
    createdAt: Date | string;
  }>;
}

export function SellerOnboardingWorkspace({
  initialApplication,
}: {
  initialApplication: ApplicationData | null;
}) {
  const [app, setApp] = useState<ApplicationData>(
    initialApplication || {
      legalBusinessName: "",
      tradingName: "",
      businessRegNumber: "",
      taxVatNumber: "",
      countryCode: "PK",
      city: "",
      addressLine: "",
      websiteUrl: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      bankName: "",
      bankAccountTitle: "",
      bankIban: "",
      notes: "",
      status: "DRAFT",
    }
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLocked =
    app.status === "SUBMITTED" || app.status === "UNDER_REVIEW" || app.status === "APPROVED";

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setFeedbackMessage(null);
    try {
      const res = await fetch("/api/seller/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...app, action: "draft" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save draft.");
      setApp((prev) => ({ ...prev, ...data.application }));
      setFeedbackMessage("Application draft saved successfully.");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error saving draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setFeedbackMessage(null);
    try {
      const res = await fetch("/api/seller/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...app, action: "submit" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit application.");
      setApp((prev) => ({ ...prev, ...data.application }));
      setFeedbackMessage("Application submitted! Platform administration has been notified.");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error submitting application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", docType);
      if (app.id) formData.append("applicationId", app.id);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload document.");

      // Refresh documents
      setApp((prev) => ({
        ...prev,
        documents: [...(prev.documents || []), data.document],
      }));
      setFeedbackMessage(`Uploaded ${file.name} successfully.`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error uploading document");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Status Tracker Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Store size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Seller Onboarding Workspace
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Applicant tracking and verified compliance management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <Badge
              variant={
                app.status === "APPROVED"
                  ? "success"
                  : app.status === "CHANGES_REQUESTED"
                  ? "warning"
                  : app.status === "REJECTED"
                  ? "danger"
                  : "default"
              }
              size="md"
            >
              {app.status.replace("_", " ")}
            </Badge>
          </div>
        </div>

        {/* Reviewer Feedback Notice */}
        {app.status === "CHANGES_REQUESTED" && app.reviewerFeedback && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <AlertCircle size={15} className="text-amber-600" />
              <span>Administrative Feedback Received</span>
            </div>
            <p className="leading-relaxed pl-6">{app.reviewerFeedback}</p>
            <p className="text-[11px] text-amber-700 pl-6">
              Please adjust the requested information below and resubmit for evaluation.
            </p>
          </div>
        )}

        {app.status === "REJECTED" && (
          <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-rose-950">
              <AlertCircle size={16} className="text-rose-600" />
              <span>Application Decision: Rejected</span>
            </div>
            <p className="leading-relaxed pl-6">
              {app.reviewerFeedback || "Your application was evaluated and could not be approved based on current merchant criteria."}
            </p>
            <div className="pl-6 pt-1 flex items-center gap-3">
              <a
                href="mailto:compliance@wizz.pk"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-800 font-bold hover:bg-rose-100 transition"
              >
                <span>Contact Merchant Compliance</span>
              </a>
              <span className="text-slate-400">&bull;</span>
              <span className="text-slate-500">Support Ref: APP-{app.id?.slice(-6) || "WIZZ"}</span>
            </div>
          </div>
        )}

        {app.status === "APPROVED" && (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-emerald-950">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Seller Organization Approved & Active!</span>
            </div>
            <p className="leading-relaxed pl-6">
              Your merchant organization has been fully verified and approved on WIZZ.PK. Selling capabilities are activated.
            </p>
            <div className="pl-6 pt-1">
              <a
                href="/seller/portal"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition shadow-sm"
              >
                <span>Enter Seller Workspace</span>
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
        )}

        {app.status === "SUBMITTED" && (
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-indigo-950">
              <Clock size={15} className="text-indigo-600" />
              <span>Application Under Evaluation</span>
            </div>
            <p className="leading-relaxed pl-6">
              Your application has been received by WIZZ.PK platform administration. Standard verification turnaround is 24-48 business hours. In the meantime, you may begin drafting your catalog listings in the Seller Workspace.
            </p>
            <div className="pl-6 pt-2">
              <a
                href="/seller/portal"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:underline"
              >
                <span>Explore Seller Workspace Drafts</span>
                <ArrowRight size={12} />
              </a>
            </div>
          </div>
        )}
      </div>

      {feedbackMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Application Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Store & Brand Profile */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              1
            </div>
            <h3 className="font-bold text-base text-slate-900">
              Store & Brand Identity
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Trading Store Name (Public)"
              required
              disabled={isLocked}
              placeholder="e.g. CraftGear Adventure Tools"
              value={app.tradingName}
              onChange={(e) => setApp({ ...app, tradingName: e.target.value })}
            />

            <Input
              label="Brand Website (Optional)"
              type="url"
              disabled={isLocked}
              placeholder="https://yourbrand.com"
              value={app.websiteUrl || ""}
              onChange={(e) => setApp({ ...app, websiteUrl: e.target.value })}
            />
          </div>
        </div>

        {/* Step 2: Legal Entity & Tax Information */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              2
            </div>
            <h3 className="font-bold text-base text-slate-900">
              Legal Business Entity & Tax Identifiers
            </h3>
          </div>

          <div className="space-y-4">
            <Input
              label="Legal Registered Business Name"
              required
              disabled={isLocked}
              placeholder="e.g. CraftGear Outfitters LLC"
              value={app.legalBusinessName}
              onChange={(e) => setApp({ ...app, legalBusinessName: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Company Registration / CR Number"
                disabled={isLocked}
                placeholder="REG-US-887410"
                value={app.businessRegNumber || ""}
                onChange={(e) => setApp({ ...app, businessRegNumber: e.target.value })}
              />

              <Input
                label="Tax Identification / VAT Number"
                disabled={isLocked}
                placeholder="VAT-US-99120"
                value={app.taxVatNumber || ""}
                onChange={(e) => setApp({ ...app, taxVatNumber: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Step 3: Contact & Warehouse Logistics */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              3
            </div>
            <h3 className="font-bold text-base text-slate-900">
              Contact & Warehouse Logistics
            </h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Primary Contact Person"
                required
                disabled={isLocked}
                placeholder="David Vance"
                value={app.contactName}
                onChange={(e) => setApp({ ...app, contactName: e.target.value })}
              />

              <Input
                label="Business Email"
                type="email"
                required
                disabled={isLocked}
                placeholder="david@craftgear.com"
                value={app.contactEmail}
                onChange={(e) => setApp({ ...app, contactEmail: e.target.value })}
              />

              <Input
                label="Direct Phone Number"
                type="tel"
                required
                disabled={isLocked}
                placeholder="+1 (555) 831-4099"
                value={app.contactPhone}
                onChange={(e) => setApp({ ...app, contactPhone: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Warehouse Pickup & Return Street Address"
                  required
                  disabled={isLocked}
                  placeholder="1280 Waterfront Way, Suite 400"
                  value={app.addressLine}
                  onChange={(e) => setApp({ ...app, addressLine: e.target.value })}
                />
              </div>

              <Input
                label="City / Hub"
                required
                disabled={isLocked}
                placeholder="Portland"
                value={app.city}
                onChange={(e) => setApp({ ...app, city: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Merchant Operations Overview & Product Catalog Summary
              </label>
              <textarea
                rows={3}
                disabled={isLocked}
                placeholder="Describe your manufacturing standards, types of physical hardware or gear, and current logistics fulfillment model..."
                value={app.notes || ""}
                onChange={(e) => setApp({ ...app, notes: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Step 4: Settlement & Payout Bank Details */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              4
            </div>
            <h3 className="font-bold text-base text-slate-900">
              Settlement & Payout Bank Account
            </h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Marketplace net sales proceeds will be remitted to this nominated Pakistani bank account after fulfillment settlement cycles.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Bank Name"
              required
              disabled={isLocked}
              placeholder="Meezan Bank / HBL / MCB / Bank Alfalah"
              value={app.bankName || ""}
              onChange={(e) => setApp({ ...app, bankName: e.target.value })}
            />

            <Input
              label="Account Title"
              required
              disabled={isLocked}
              placeholder="e.g. CraftGear Pvt Ltd"
              value={app.bankAccountTitle || ""}
              onChange={(e) => setApp({ ...app, bankAccountTitle: e.target.value })}
            />

            <Input
              label="24-Digit IBAN"
              required
              disabled={isLocked}
              placeholder="PK36MEZN0001234567890123"
              value={app.bankIban || ""}
              onChange={(e) => setApp({ ...app, bankIban: e.target.value })}
            />
          </div>
        </div>

        {/* Step 5: KYC Document Uploads */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              5
            </div>
            <h3 className="font-bold text-base text-slate-900">
              KYC Verification Documents
            </h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Upload official documentation to confirm business entity validity. Documents are stored in encrypted private storage accessible strictly to platform compliance officers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-dashed border-slate-300 space-y-3 bg-slate-50/60">
              <span className="font-bold text-xs text-slate-800 block">
                Certificate of Incorporation / Registration
              </span>
              <input
                type="file"
                disabled={isLocked || isUploading}
                onChange={(e) => handleFileUpload(e, "BUSINESS_REGISTRATION")}
                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>

            <div className="p-4 rounded-2xl border border-dashed border-slate-300 space-y-3 bg-slate-50/60">
              <span className="font-bold text-xs text-slate-800 block">
                Tax Identification / Reseller Certificate
              </span>
              <input
                type="file"
                disabled={isLocked || isUploading}
                onChange={(e) => handleFileUpload(e, "TAX_CERTIFICATE")}
                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
          </div>

          {/* Uploaded Documents List */}
          {app.documents && app.documents.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Attached Documents ({app.documents.length})
              </h4>
              <div className="space-y-2">
                {app.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-indigo-600" />
                      <span className="font-semibold text-slate-800">{doc.originalFilename}</span>
                      <Badge variant="neutral" size="sm">
                        {doc.documentType}
                      </Badge>
                    </div>
                    <span className="text-slate-400 text-[11px]">
                      {(doc.fileSizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        {!isLocked && (
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSaving || isSubmitting}
              isLoading={isSaving}
              onClick={handleSaveDraft}
            >
              Save Draft Progress
            </Button>

            <Button
              type="submit"
              size="lg"
              disabled={isSaving || isSubmitting}
              isLoading={isSubmitting}
              className="shadow-lg shadow-indigo-600/25"
            >
              <span>Submit Application for Review</span>
              <ArrowRight size={18} />
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
