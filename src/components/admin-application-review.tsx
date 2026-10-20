"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatters";
import {
  Store,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  ExternalLink,
} from "lucide-react";

export interface AdminAppItem {
  id: string;
  applicantUserId: string;
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
  notes?: string | null;
  status: string;
  reviewerFeedback?: string | null;
  approvedOrgId?: string | null;
  createdAt: Date | string;
  applicantUser: { email: string; firstName: string; lastName: string };
  documents: Array<{
    id: string;
    originalFilename: string;
    documentType: string;
    fileSizeBytes: number;
    fileKey: string;
  }>;
}

export function AdminApplicationReview({
  applications: initialApplications,
}: {
  applications: AdminAppItem[];
}) {
  const [applications, setApplications] = useState<AdminAppItem[]>(initialApplications);
  const [selectedAppId, setSelectedAppId] = useState<string>(
    initialApplications[0]?.id || ""
  );
  const [feedbackNote, setFeedbackNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedApp =
    applications.find((a) => a.id === selectedAppId) || applications[0];

  const handleDecision = async (decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") => {
    if (!selectedApp) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/admin/applications/${selectedApp.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          feedbackNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit review.");

      // Update state
      setApplications((prev) =>
        prev.map((a) =>
          a.id === selectedApp.id
            ? { ...a, status: data.application.status, reviewerFeedback: feedbackNote }
            : a
        )
      );

      setStatusMessage(`Application ${selectedApp.tradingName} marked as ${decision}!`);
      setFeedbackNote("");
    } catch (err: unknown) {
      setStatusMessage(err instanceof Error ? err.message : "Error submitting review");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (applications.length === 0) {
    return (
      <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 p-12 text-center text-slate-400">
        No seller applications have been submitted yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Applications List (Left 5 cols) */}
      <div className="lg:col-span-5 space-y-3">
        <h3 className="font-bold text-sm text-slate-300 mb-2">
          Applications Pipeline ({applications.length})
        </h3>
        {applications.map((app) => {
          const isSelected = app.id === selectedAppId;
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => {
                setSelectedAppId(app.id);
                setFeedbackNote(app.reviewerFeedback || "");
                setStatusMessage(null);
              }}
              className={`w-full text-left p-4 rounded-2xl border transition-all ${
                isSelected
                  ? "border-indigo-500 bg-slate-800 ring-1 ring-indigo-500 shadow-md"
                  : "border-slate-800 bg-slate-900/60 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-white">{app.tradingName}</h4>
                  <p className="text-slate-400 text-xs mt-0.5 truncate">{app.legalBusinessName}</p>
                </div>
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
                  size="sm"
                >
                  {app.status}
                </Badge>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span>By: {app.applicantUser.email}</span>
                <span>{new Date(app.createdAt).toLocaleDateString()}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Application Detail & Actions (Right 7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        {selectedApp && (
          <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/80">
              <div>
                <h3 className="text-xl font-black text-white">{selectedApp.tradingName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Application ID: {selectedApp.id}
                </p>
              </div>
              <Badge
                variant={
                  selectedApp.status === "APPROVED"
                    ? "success"
                    : selectedApp.status === "CHANGES_REQUESTED"
                    ? "warning"
                    : selectedApp.status === "REJECTED"
                    ? "danger"
                    : "default"
                }
                size="md"
              >
                {selectedApp.status}
              </Badge>
            </div>

            {statusMessage && (
              <div className="p-3 rounded-xl bg-indigo-900/40 border border-indigo-700 text-indigo-200 text-xs flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* KYC Specifications */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div>
                  <span className="text-slate-500 block">Legal Business Name</span>
                  <span className="font-bold text-white mt-0.5 block">
                    {selectedApp.legalBusinessName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Registration Number</span>
                  <span className="font-mono font-semibold text-slate-300 mt-0.5 block">
                    {selectedApp.businessRegNumber || "Not Provided"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tax / VAT ID</span>
                  <span className="font-mono font-semibold text-slate-300 mt-0.5 block">
                    {selectedApp.taxVatNumber || "Not Provided"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Brand Website</span>
                  <span className="text-indigo-400 mt-0.5 block truncate">
                    {selectedApp.websiteUrl || "N/A"}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[10px]">
                  Logistics & Contact Information
                </span>
                <p className="text-slate-300">
                  Contact: <strong className="text-white">{selectedApp.contactName}</strong> (
                  {selectedApp.contactEmail} • {selectedApp.contactPhone})
                </p>
                <p className="text-slate-300">
                  Warehouse Hub: {selectedApp.addressLine}, {selectedApp.city},{" "}
                  {selectedApp.countryCode}
                </p>
                {selectedApp.notes && (
                  <p className="text-slate-400 italic pt-1 border-t border-slate-800">
                    "{selectedApp.notes}"
                  </p>
                )}
              </div>

              {/* Uploaded Documents */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[10px]">
                  Attached KYC Documents ({selectedApp.documents.length})
                </span>
                {selectedApp.documents.length === 0 ? (
                  <p className="text-slate-500 text-xs">No files attached yet by applicant.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedApp.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <FileText size={15} className="text-indigo-400" />
                          <span className="font-semibold text-white">{doc.originalFilename}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({doc.documentType})
                          </span>
                        </div>
                        <a
                          href={`/api/uploads/serve?key=${encodeURIComponent(doc.fileKey)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                          <span>Inspect</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reviewer Action Controls */}
            <div className="pt-4 border-t border-slate-700/80 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Reviewer Feedback / Adjustment Notes
                </label>
                <textarea
                  rows={3}
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  placeholder="Specify required amendments, document deficiencies, or approval notes..."
                  className="w-full text-xs rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 justify-end">
                {selectedApp.approvedOrgId && selectedApp.status === "APPROVED" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={async () => {
                        const reason = prompt("Enter suspension reason for this seller:");
                        if (!reason) return;
                        setIsSubmitting(true);
                        try {
                          const res = await fetch(`/api/admin/sellers/${selectedApp.approvedOrgId}/suspend`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "SUSPEND", reason }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Failed to suspend");
                          setStatusMessage(`Seller organization suspended: ${reason}`);
                        } catch (err: unknown) {
                          setStatusMessage(err instanceof Error ? err.message : "Error");
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      className="border-rose-700/60 text-rose-400 hover:bg-rose-950/40"
                    >
                      <AlertCircle size={15} />
                      <span>Suspend Seller</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={async () => {
                        setIsSubmitting(true);
                        try {
                          const res = await fetch(`/api/admin/sellers/${selectedApp.approvedOrgId}/suspend`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "REACTIVATE" }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Failed to reactivate");
                          setStatusMessage("Seller organization restored to ACTIVE status.");
                        } catch (err: unknown) {
                          setStatusMessage(err instanceof Error ? err.message : "Error");
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      className="border-emerald-700/60 text-emerald-400 hover:bg-emerald-950/40"
                    >
                      <CheckCircle2 size={15} />
                      <span>Reactivate Seller</span>
                    </Button>
                  </>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => handleDecision("CHANGES_REQUESTED")}
                  className="border-amber-600/60 text-amber-400 hover:bg-amber-950/40"
                >
                  <AlertCircle size={15} />
                  <span>Request Changes</span>
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => handleDecision("REJECTED")}
                >
                  <XCircle size={15} />
                  <span>Reject</span>
                </Button>

                <Button
                  variant="accent"
                  size="sm"
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                  onClick={() => handleDecision("APPROVED")}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  <CheckCircle2 size={15} />
                  <span>Approve & Provision Seller Org</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
