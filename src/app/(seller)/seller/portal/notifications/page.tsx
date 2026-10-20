"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, Clock, AlertTriangle, PackageOpen, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SellerNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/seller/notifications");
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch("/api/seller/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications(
        notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // silent
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Notification Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational updates, order alerts, application verification milestones, and low-stock notices.
          </p>
        </div>

        <Button size="sm" variant="ghost" onClick={loadNotifications}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </Button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Bell size={32} className="mx-auto text-slate-300" />
            <p className="text-xs text-slate-500">You're all caught up! No notifications.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-6 flex items-start justify-between gap-4 transition ${
                n.isRead ? "bg-white opacity-80" : "bg-indigo-50/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    n.type === "APPLICATION"
                      ? "bg-indigo-50 text-indigo-600"
                      : n.type === "INVENTORY"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  <Bell size={16} />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">{n.title}</h2>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                    {n.linkUrl && (
                      <Link
                        href={n.linkUrl}
                        className="font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                      >
                        <span>View Details</span>
                        <ExternalLink size={10} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {!n.isRead && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 shrink-0"
                >
                  Mark as read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
