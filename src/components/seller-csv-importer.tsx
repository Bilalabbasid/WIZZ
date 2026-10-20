"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  HelpCircle,
  FileText,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SellerCsvImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SellerCsvImporter({ isOpen, onClose, onSuccess }: SellerCsvImporterProps) {
  const [csvText, setCsvText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Generate and download sample CSV template
  const handleDownloadTemplate = () => {
    const sampleHeaders = "sku,title,category,price,compare_at_price,stock,variant_title,description\n";
    const sampleRow1 = "WIZ-TSH-BLK-M,Classic Cotton T-Shirt,Fashion,1999,2499,50,Black / Medium,Premium combed cotton shirt\n";
    const sampleRow2 = "WIZ-TSH-BLK-L,Classic Cotton T-Shirt,Fashion,1999,2499,35,Black / Large,Premium combed cotton shirt\n";
    const sampleRow3 = "WIZ-HDPHN-PRO,Wireless Audio Pro,Electronics,4500,5500,20,Default,Active noise cancellation headphones\n";

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(sampleHeaders + sampleRow1 + sampleRow2 + sampleRow3);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", csvContent);
    downloadAnchor.setAttribute("download", "wizz_pk_catalog_import_template.csv");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setPreviewResult(null);
    setCommitResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseAndPreviewCsv(text);
    };
    reader.readAsText(file);
  };

  const parseCsvToRows = (rawText: string) => {
    const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error("CSV file must contain a header line and at least one data row.");
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    const skuIdx = headers.indexOf("sku");
    const titleIdx = headers.indexOf("title");
    const catIdx = headers.indexOf("category");
    const priceIdx = headers.indexOf("price");
    const compareIdx = headers.indexOf("compare_at_price");
    const stockIdx = headers.indexOf("stock");
    const variantTitleIdx = headers.indexOf("variant_title");
    const descIdx = headers.indexOf("description");

    if (skuIdx === -1) {
      throw new Error("CSV is missing the mandatory 'sku' column.");
    }

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      // Basic CSV cell parser respecting quotes
      const cells = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      if (cells.length < 1 || !cells[skuIdx]) continue;

      rows.push({
        sku: cells[skuIdx],
        title: titleIdx !== -1 ? cells[titleIdx] : undefined,
        category: catIdx !== -1 ? cells[catIdx] : undefined,
        pricePkr: priceIdx !== -1 && cells[priceIdx] ? parseFloat(cells[priceIdx]) : 0,
        compareAtPricePkr:
          compareIdx !== -1 && cells[compareIdx] ? parseFloat(cells[compareIdx]) : null,
        stock: stockIdx !== -1 && cells[stockIdx] ? parseInt(cells[stockIdx], 10) : 0,
        variantTitle: variantTitleIdx !== -1 ? cells[variantTitleIdx] : undefined,
        description: descIdx !== -1 ? cells[descIdx] : undefined,
      });
    }

    return rows;
  };

  const parseAndPreviewCsv = async (text: string) => {
    setIsPreviewing(true);
    setError(null);

    try {
      const rows = parseCsvToRows(text);
      const res = await fetch("/api/seller/products/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, dryRun: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to preview CSV.");
      }

      setPreviewResult(data.result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error parsing CSV");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!csvText) return;
    setIsCommitting(true);
    setError(null);

    try {
      const rows = parseCsvToRows(csvText);
      const res = await fetch("/api/seller/products/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, dryRun: false }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed executing CSV import.");
      }

      setCommitResult(data.result);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error committing CSV import.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Bulk CSV Product & Stock Import
              </h2>
              <p className="text-xs text-slate-500">
                Match on SKU &bull; Preview validation errors &bull; Safe transactional upsert
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Documented Upsert Rules */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-indigo-900">
              <HelpCircle size={15} />
              <span>Documented Catalog Upsert Rules</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
              <li>
                <strong>Match on SKU:</strong> If the SKU already exists in your seller catalog, the system updates its selling price, compare-at price, and sets stock to the specified balance.
              </li>
              <li>
                <strong>New SKUs:</strong> If the SKU does not exist, a new product and variant listing are created in your catalog in <code>DRAFT</code> status.
              </li>
              <li>
                <strong>Strict Tenant Isolation:</strong> You cannot update SKUs belonging to other merchants.
              </li>
              <li>
                <strong>Price & Stock Validation:</strong> Prices must be positive; compare-at promotional price must exceed selling price; stock cannot be negative.
              </li>
            </ul>
          </div>

          {/* Upload Area / Template */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
            <div className="space-y-1">
              <p className="font-bold text-slate-800">Select or drop a CSV file</p>
              <p className="text-slate-400 text-[11px]">
                {fileName ? `Loaded: ${fileName}` : "Format: .csv with UTF-8 encoding"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="text-xs"
              >
                <Download size={14} />
                <span>Download Sample Template</span>
              </Button>

              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm">
                <Upload size={14} />
                <span>Browse File</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3 font-semibold">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Commit Success Banner */}
          {commitResult && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>CSV Catalog Import Succeeded!</span>
              </div>
              <p className="text-xs text-emerald-800">
                Successfully processed <strong>{commitResult.validCount}</strong> row(s):
                {" "}Created <strong>{commitResult.createdProducts}</strong> new product(s),
                {" "}Created <strong>{commitResult.createdVariants}</strong> new variant(s),
                {" "}Updated <strong>{commitResult.updatedVariants}</strong> existing variant(s).
              </p>
            </div>
          )}

          {/* Preview Table */}
          {isPreviewing && (
            <div className="py-8 text-center space-y-2">
              <RefreshCw className="animate-spin text-indigo-600 mx-auto" size={24} />
              <p className="text-slate-500 font-semibold">Validating rows against catalog rules...</p>
            </div>
          )}

          {previewResult && !commitResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">Pre-Import Row Validation Preview</h3>
                  <p className="text-slate-500 text-[11px]">
                    Total rows: {previewResult.totalRows} &bull; Valid:{" "}
                    <span className="text-emerald-600 font-bold">{previewResult.validCount}</span> &bull; Errors:{" "}
                    <span className="text-rose-600 font-bold">{previewResult.errorCount}</span>
                  </p>
                </div>
              </div>

              {/* Per-row errors list if any */}
              {previewResult.errors.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1.5">
                  <p className="font-bold text-rose-900 text-[11px] uppercase tracking-wider">
                    Errors detected ({previewResult.errors.length}):
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {previewResult.errors.map((err: any, idx: number) => (
                      <p key={idx} className="text-[11px] text-rose-800">
                        &bull; <strong>Row {err.row}</strong> {err.sku ? `(SKU: ${err.sku})` : ""}: {err.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Title</th>
                      <th className="py-2.5 px-3">Price (PKR)</th>
                      <th className="py-2.5 px-3">Stock</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewResult.previewRows?.map((r: any, idx: number) => (
                      <tr
                        key={idx}
                        className={r.isValid ? "hover:bg-slate-50/50" : "bg-rose-50/30"}
                      >
                        <td className="py-2 px-3 font-mono text-slate-400">#{r.row}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{r.sku}</td>
                        <td className="py-2 px-3 truncate max-w-xs">{r.title}</td>
                        <td className="py-2 px-3 font-semibold text-emerald-700">Rs. {r.pricePkr}</td>
                        <td className="py-2 px-3 font-bold">{r.stock}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                              r.action === "UPDATE"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {r.action}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {r.isValid ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 size={12} /> Ready
                            </span>
                          ) : (
                            <span className="text-rose-600 font-semibold" title={r.error}>
                              {r.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>

          {previewResult && !commitResult && (
            <Button
              type="button"
              size="sm"
              onClick={handleCommitImport}
              isLoading={isCommitting}
              disabled={isCommitting || previewResult.validCount === 0}
              className="font-bold shadow-md shadow-emerald-600/20"
            >
              <span>Commit Import ({previewResult.validCount} Valid Rows)</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
