"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";

export function OrderActions({
  orderId,
  canCancel,
  canReturn,
  sellerOrderId,
  items,
}: {
  orderId: string;
  canCancel: boolean;
  canReturn: boolean;
  sellerOrderId?: string;
  items: Array<{ id: string; productTitleSnapshot: string; variantNameSnapshot: string }>;
}) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Return state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || "");
  const [returnReason, setReturnReason] = useState("DAMAGED");
  const [returnExplanation, setReturnExplanation] = useState("");
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || "Customer requested cancellation" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel order.");
      window.location.reload();
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : "Error cancelling order");
      setIsCancelling(false);
    }
  };

  const handleReturn = async () => {
    if (!sellerOrderId) return;
    setIsSubmittingReturn(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerOrderId,
          orderItemId: selectedItemId,
          quantity: 1,
          reasonCode: returnReason,
          explanation: returnExplanation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit return request.");
      window.location.reload();
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : "Error submitting return");
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className="space-y-4">
      {actionMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{actionMessage}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCancelModal(true)}
            className="text-rose-600 border-rose-200 hover:bg-rose-50"
          >
            <XCircle size={15} />
            <span>Cancel Order</span>
          </Button>
        )}

        {canReturn && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReturnModal(true)}
            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
          >
            <RotateCcw size={15} />
            <span>Request Return</span>
          </Button>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-slate-900">Cancel Your Order?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Orders can be cancelled before fulfillment and carrier dispatch. Once cancelled, reserved inventory will be released and payment will be refunded.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Cancellation
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Changed mind, ordered by mistake, etc."
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
              >
                Keep Order
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancel}
                isLoading={isCancelling}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-slate-900">Request Item Return</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              WIZZ.PK 30-day return policy. Items must be in original condition.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Item to Return
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.productTitleSnapshot} ({i.variantNameSnapshot})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason Code
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  <option value="DEFECTIVE">Defective or Damaged</option>
                  <option value="NOT_AS_DESCRIBED">Item Does Not Match Description</option>
                  <option value="WRONG_ITEM">Wrong Item Received</option>
                  <option value="UNWANTED">No Longer Needed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Explanation / Notes
                </label>
                <textarea
                  rows={2}
                  value={returnExplanation}
                  onChange={(e) => setReturnExplanation(e.target.value)}
                  placeholder="Provide context regarding the return..."
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReturnModal(false)}
                disabled={isSubmittingReturn}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleReturn}
                isLoading={isSubmittingReturn}
              >
                Submit Return Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
