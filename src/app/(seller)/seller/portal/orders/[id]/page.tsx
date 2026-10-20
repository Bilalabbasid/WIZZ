"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  PackageOpen,
  MapPin,
  Truck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPkr } from "@/lib/formatters";

export default function SellerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Status update
  const [newStatus, setNewStatus] = useState<string>("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Shipment dispatch form
  const [carrierName, setCarrierName] = useState("TCS Express");
  const [trackingNumber, setTrackingNumber] = useState(`PK-${Date.now().toString().slice(-8)}`);
  const [isDispatching, setIsDispatching] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/seller/orders/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load order");
      setOrder(data.order);
      setNewStatus(data.order.status);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading order");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    setIsUpdatingStatus(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/seller/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      setFeedback(`Order status updated to ${newStatus}.`);
      loadOrder();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error updating status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDispatching(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/seller/orders/${id}/shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrierName,
          trackingNumber,
          trackingUrl: `https://tracking.wizz.pk/${trackingNumber}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create shipment");
      setFeedback(`Waybill generated! Package marked DISPATCHED with ${carrierName}.`);
      loadOrder();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error dispatching shipment");
    } finally {
      setIsDispatching(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading package details...</div>;
  }

  if (!order) {
    return (
      <div className="p-8 bg-rose-50 rounded-2xl text-rose-800 text-xs">
        {error || "Order not found."}
      </div>
    );
  }

  let address: any = {};
  try {
    address = JSON.parse(order.customerOrder.shippingAddressJson);
  } catch {
    address = { street1: order.customerOrder.shippingAddressJson };
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/seller/portal/orders"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5"
        >
          <ArrowLeft size={14} />
          <span>Return to Orders List</span>
        </Link>
        <span className="text-xs text-slate-400 font-mono">
          Master Order: {order.customerOrder.orderNumber}
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Package #{order.sellerOrderNumber}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Placed on {new Date(order.createdAt).toLocaleString()} &bull; Payment:{" "}
            <strong className="text-slate-800">{order.customerOrder.paymentStatus}</strong>
          </p>
        </div>

        <Badge
          variant={
            order.status === "DELIVERED"
              ? "success"
              : order.status === "DISPATCHED"
              ? "default"
              : order.status === "PACKING"
              ? "warning"
              : "neutral"
          }
          size="md"
        >
          {order.status}
        </Badge>
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Items in this Seller Package */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Package Contents</h2>
          </div>
          <span className="text-xs text-slate-400">
            {order.items.length} unique {order.items.length === 1 ? "line" : "lines"}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {order.items.map((item: any) => (
            <div key={item.id} className="p-6 flex items-center justify-between gap-4 text-xs">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{item.productTitleSnapshot}</h3>
                <div className="text-slate-500 mt-0.5">
                  Variant: <span className="font-medium">{item.variantNameSnapshot}</span> &bull; SKU:{" "}
                  <span className="font-mono">{item.skuSnapshot}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="font-bold text-slate-900 text-sm">
                  {formatPkr(item.totalMinor)}
                </div>
                <div className="text-slate-400 text-[11px]">
                  {item.quantity} &times; {formatPkr(item.unitPriceMinor)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Financial Summary */}
        <div className="bg-slate-50 p-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between gap-4 text-xs">
          <div>
            <span className="text-slate-500">Commission Deducted (10%):</span>
            <div className="font-bold text-rose-600">
              -{formatPkr(order.platformCommissionMinor)}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Shipping Allowance:</span>
            <div className="font-bold text-slate-800">{formatPkr(order.shippingMinor)}</div>
          </div>
          <div>
            <span className="text-slate-500">Net Seller Payable:</span>
            <div className="font-black text-emerald-700 text-base">
              {formatPkr(order.netSellerPayableMinor)}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Shipping Address & Carrier Waybill Generation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Destination Address */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <MapPin size={16} className="text-indigo-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Destination Delivery Address
            </h2>
          </div>

          <div className="text-xs space-y-1 text-slate-700">
            <p className="font-bold text-slate-900 text-sm">
              {address.fullName || order.customerOrder.customerEmail}
            </p>
            <p>{address.street1}</p>
            {address.street2 && <p>{address.street2}</p>}
            <p>
              {address.city}, {address.stateProvince || ""} {address.postalCode || ""}
            </p>
            <p className="text-slate-500 font-mono">
              Phone: {address.phone || order.customerOrder.customerPhone || "N/A"}
            </p>
          </div>
        </div>

        {/* Packing Status Management */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <PackageOpen size={16} className="text-indigo-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Update Packing Status
            </h2>
          </div>

          <div className="space-y-3">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="CONFIRMED">CONFIRMED (Awaiting Packing)</option>
              <option value="PACKING">PACKING (In Warehouse Assembly)</option>
              <option value="DISPATCHED">DISPATCHED (Handed to Carrier)</option>
              <option value="DELIVERED">DELIVERED (Customer Received)</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            <Button
              size="sm"
              variant="outline"
              onClick={handleUpdateStatus}
              isLoading={isUpdatingStatus}
              disabled={isUpdatingStatus}
            >
              Update Status
            </Button>
          </div>
        </div>
      </div>

      {/* Shipment & Waybill Generator */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-900">
              Courier Dispatch & Waybill Generation
            </h2>
          </div>

          {order.shipments && order.shipments.length > 0 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <Printer size={13} />
              <span>Print Waybill</span>
            </button>
          )}
        </div>

        {order.shipments && order.shipments.length > 0 ? (
          <div className="space-y-4">
            {order.shipments.map((s: any) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/70 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900">
                    Carrier: <span className="text-indigo-700">{s.carrierName}</span>
                  </div>
                  <Badge variant="default" size="sm">
                    {s.status}
                  </Badge>
                </div>
                <div className="font-mono text-slate-700">
                  Tracking Waybill #: <strong>{s.trackingNumber}</strong>
                </div>
                {s.shippedAt && (
                  <div className="text-[11px] text-slate-500">
                    Dispatched on: {new Date(s.shippedAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleCreateShipment} className="space-y-4">
            <p className="text-xs text-slate-500">
              Assign an integrated logistics carrier (TCS, Leopards, M&P, Trax, PostEx) and generate the printable tracking waybill.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Courier Carrier
                </label>
                <select
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="TCS Express">TCS Express</option>
                  <option value="Leopards Courier">Leopards Courier</option>
                  <option value="M&P Logistics">M&P Logistics</option>
                  <option value="Trax Logistics">Trax Logistics</option>
                  <option value="PostEx Delivery">PostEx Delivery</option>
                </select>
              </div>

              <Input
                label="Carrier Tracking / Airway Bill #"
                required
                value={trackingNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrackingNumber(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              isLoading={isDispatching}
              disabled={isDispatching}
              className="shadow-md shadow-indigo-600/20"
            >
              <Truck size={16} />
              <span>Generate Waybill & Dispatch Package</span>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
