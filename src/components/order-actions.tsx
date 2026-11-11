"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";

export interface ReturnablePackage {
  sellerOrderId: string;
  sellerName: string;
  sellerOrderNumber: string;
  windowOpen: boolean;
  windowEndsLabel: string;
  items: Array<{ id: string; title: string; variant: string; returnableQuantity: number }>;
}

/** Must match the reason codes the returns API accepts. */
const RETURN_REASONS = [
  { value: "DEFECTIVE", label: "Defective or damaged" },
  { value: "NOT_AS_DESCRIBED", label: "Item does not match the description" },
  { value: "WRONG_ITEM", label: "Wrong item received" },
  { value: "UNWANTED", label: "No longer needed" },
] as const;

function Modal({
  title,
  onClose,
  children,
  busy,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  busy: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Latest props in refs so the mount-only effect below never re-runs (which would steal focus).
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("input:not([disabled]), select, textarea, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-t-3xl sm:rounded-[28px] max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h3 id={titleId} className="font-bold text-lg text-ink">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

export function OrderActions({
  orderId,
  canCancel,
  returnablePackages,
}: {
  orderId: string;
  canCancel: boolean;
  returnablePackages: ReturnablePackage[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Cancel
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Return
  const [returnPkg, setReturnPkg] = useState<ReturnablePackage | null>(null);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [returnErrors, setReturnErrors] = useState<string[]>([]);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() || "Customer requested cancellation" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We could not cancel this order.");
      setShowCancel(false);
      setMessage({ type: "success", text: "Your order has been cancelled." });
      router.refresh();
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "We could not cancel this order.");
    } finally {
      setIsCancelling(false);
    }
  };

  const openReturn = (pkg: ReturnablePackage) => {
    setReturnPkg(pkg);
    const firstReturnable = pkg.items.filter((i) => i.returnableQuantity > 0);
    // Pre-select the only item when there is just one
    setSelected(firstReturnable.length === 1 ? { [firstReturnable[0].id]: 1 } : {});
    setReason("");
    setExplanation("");
    setReturnErrors([]);
  };

  const handleReturn = async () => {
    if (!returnPkg) return;
    const lines = Object.entries(selected).filter(([, qty]) => qty > 0);
    const errs: string[] = [];
    if (lines.length === 0) errs.push("Choose at least one item to return.");
    if (!reason) errs.push("Choose a reason for the return.");
    if (errs.length) {
      setReturnErrors(errs);
      return;
    }

    setIsSubmittingReturn(true);
    setReturnErrors([]);
    const failures: string[] = [];
    let succeeded = 0;
    // The API takes one item per request; submit each selected line.
    for (const [orderItemId, quantity] of lines) {
      const item = returnPkg.items.find((i) => i.id === orderItemId);
      try {
        const res = await fetch(`/api/orders/${orderId}/returns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerOrderId: returnPkg.sellerOrderId,
            orderItemId,
            quantity,
            reasonCode: reason,
            explanation: explanation.trim(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not submit the return.");
        succeeded++;
        setSelected((prev) => {
          const next = { ...prev };
          delete next[orderItemId];
          return next;
        });
      } catch (err) {
        failures.push(`${item?.title ?? "Item"}: ${err instanceof Error ? err.message : "Could not submit the return."}`);
      }
    }
    setIsSubmittingReturn(false);

    if (failures.length === 0) {
      setReturnPkg(null);
      setMessage({
        type: "success",
        text: `Return request submitted for ${succeeded} item${succeeded === 1 ? "" : "s"}. The seller will review it.`,
      });
      router.refresh();
    } else {
      setReturnErrors(
        succeeded > 0 ? [`${succeeded} item(s) were submitted. These could not be:`, ...failures] : failures
      );
      if (succeeded > 0) router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      <div aria-live="polite">
        {message && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              message.type === "success"
                ? "bg-brand-50 border-brand-200 text-brand-800"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canCancel && (
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setCancelError(null);
              setShowCancel(true);
            }}
            className="text-rose-600 border-rose-200 hover:bg-rose-50"
          >
            <XCircle size={15} />
            <span>Cancel order</span>
          </Button>
        )}
      </div>

      {returnablePackages.length > 0 && (
        <ul className="space-y-2">
          {returnablePackages.map((pkg) => {
            const anyLeft = pkg.items.some((i) => i.returnableQuantity > 0);
            return (
              <li
                key={pkg.sellerOrderId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-[20px] border border-line"
              >
                <div className="text-xs text-mute min-w-0">
                  <p className="font-semibold text-ink truncate">Package from {pkg.sellerName}</p>
                  <p>
                    {!pkg.windowOpen
                      ? `Return window closed on ${pkg.windowEndsLabel}.`
                      : !anyLeft
                      ? "Returns already requested for every item."
                      : `Returns open until ${pkg.windowEndsLabel}.`}
                  </p>
                </div>
                {pkg.windowOpen && anyLeft && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => openReturn(pkg)}
                    className="text-brand-700 border-brand-200 hover:bg-brand-50 shrink-0"
                  >
                    <RotateCcw size={15} />
                    <span>Request return</span>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showCancel && (
        <Modal title="Cancel your order?" onClose={() => setShowCancel(false)} busy={isCancelling}>
          <p className="text-xs text-mute leading-relaxed">
            Orders can be cancelled until a package ships. Reserved stock is released. If you paid online, the refund is
            processed back to your payment method.
          </p>
          <div>
            <label htmlFor="cancel-reason" className="block text-xs font-semibold text-ink-2 mb-1">
              Reason (optional)
            </label>
            <textarea
              id="cancel-reason"
              rows={3}
              maxLength={500}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Changed my mind, ordered by mistake…"
              className="w-full text-sm rounded-xl border border-line p-2.5 focus:outline-none focus:ring-2 focus:ring-ink/15"
            />
          </div>
          {cancelError && (
            <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
              {cancelError}
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => setShowCancel(false)} disabled={isCancelling}>
              Keep order
            </Button>
            <Button variant="danger" size="md" onClick={handleCancel} isLoading={isCancelling}>
              Confirm cancellation
            </Button>
          </div>
        </Modal>
      )}

      {returnPkg && (
        <Modal title="Request a return" onClose={() => setReturnPkg(null)} busy={isSubmittingReturn}>
          <p className="text-xs text-mute leading-relaxed">
            Package from <strong>{returnPkg.sellerName}</strong> ({returnPkg.sellerOrderNumber}). Items should be in their
            original condition. The seller reviews each request.
          </p>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-ink-2 mb-1">Items to return</legend>
            {returnPkg.items.map((item) => {
              const checked = (selected[item.id] ?? 0) > 0;
              const disabled = item.returnableQuantity <= 0;
              const cbId = `ret-${item.id}`;
              const qtyId = `retqty-${item.id}`;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border ${
                    checked ? "border-brand-300 bg-brand-50/40" : "border-line"
                  } ${disabled ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <input
                      id={cbId}
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 accent-brand-600"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [item.id]: e.target.checked ? 1 : 0 }))
                      }
                    />
                    <label htmlFor={cbId} className="text-xs text-ink-2 min-w-0">
                      <span className="font-semibold block">{item.title}</span>
                      <span className="text-mute">
                        {item.variant}
                        {disabled ? " — already requested" : ""}
                      </span>
                    </label>
                  </div>
                  {checked && item.returnableQuantity > 1 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label htmlFor={qtyId} className="text-[11px] text-mute">
                        Qty
                      </label>
                      <select
                        id={qtyId}
                        value={selected[item.id]}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                        className="text-sm rounded-lg border border-line bg-white px-2 min-h-[40px]"
                      >
                        {Array.from({ length: item.returnableQuantity }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>

          <div>
            <label htmlFor="return-reason" className="block text-xs font-semibold text-ink-2 mb-1">
              Reason
            </label>
            <select
              id="return-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-sm rounded-xl border border-line px-2.5 min-h-[44px] bg-white"
            >
              <option value="" disabled>
                Select a reason
              </option>
              {RETURN_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="return-explanation" className="block text-xs font-semibold text-ink-2 mb-1">
              Details (optional)
            </label>
            <textarea
              id="return-explanation"
              rows={3}
              maxLength={1000}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="What's wrong with the item?"
              className="w-full text-sm rounded-xl border border-line p-2.5 focus:outline-none focus:ring-2 focus:ring-ink/15"
            />
          </div>

          {returnErrors.length > 0 && (
            <div role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5 space-y-1">
              {returnErrors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => setReturnPkg(null)} disabled={isSubmittingReturn}>
              Close
            </Button>
            <Button size="md" onClick={handleReturn} isLoading={isSubmittingReturn}>
              Submit return request
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
