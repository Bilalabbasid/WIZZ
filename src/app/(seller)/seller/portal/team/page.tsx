"use client";

import React, { useEffect, useState } from "react";
import { Users, UserPlus, ShieldCheck, Trash2, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TeamMember {
  id: string;
  role: string;
  user: { email: string; firstName?: string | null; lastName?: string | null };
}

interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  inviteUrl: string;
}

export default function SellerTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("ADMIN");
  const [isInviting, setIsInviting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTeam = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/seller/team");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load the team.");
      setMembers(data.members || []);
      setInvitations(data.invitations || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the team.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadTeam);
  }, []);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setError(null);
    setFeedback(null);

    try {
      const res = await fetch("/api/seller/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite team member");

      setFeedback(
        `Invitation created for ${inviteEmail}. Copy the invite link below and send it to them; they must sign in with that email to join.`
      );
      setInviteEmail("");
      loadTeam();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inviting member");
    } finally {
      setIsInviting(false);
    }
  };

  const copyInviteLink = async (url: string) => {
    const full = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(full);
      setFeedback("Invite link copied.");
    } catch {
      window.prompt("Copy this invite link:", full);
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!confirm("Revoke this invitation? The link will stop working.")) return;
    setError(null);
    try {
      const res = await fetch("/api/seller/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not revoke the invitation.");
      setFeedback("Invitation revoked.");
      loadTeam();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not revoke the invitation.");
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!confirm("Are you sure you want to revoke this user's organization access?")) return;
    try {
      const res = await fetch("/api/seller/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member");
      setFeedback("Team membership updated.");
      loadTeam();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error removing member");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Seller Team & Role Permissions
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Delegate catalog management, shipping operations, and store settings with role-based access control.
        </p>
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

      {/* Invite Box */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <UserPlus size={16} className="text-brand-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Invite Organization Collaborator
          </h2>
        </div>

        <form onSubmit={handleInviteSubmit} className="flex flex-col sm:flex-row items-end gap-3 text-xs">
          <div className="flex-1 w-full">
            <Input
              label="Collaborator Email Address"
              type="email"
              required
              placeholder="e.g. colleague@yourstore.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>

          <div className="w-full sm:w-56">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Assigned Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ADMIN">ADMIN (Full Operations)</option>
              <option value="CATALOG_MANAGER">CATALOG MANAGER (Products & Media)</option>
              <option value="FULFILLMENT_MANAGER">FULFILLMENT MANAGER (Orders & Dispatch)</option>
            </select>
          </div>

          <Button
            type="submit"
            isLoading={isInviting}
            disabled={isInviting}
            className="w-full sm:w-auto"
          >
            <span>Create Invite Link</span>
          </Button>
        </form>
      </div>

      {/* Active Members Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Active Team Members ({members.length})</h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading team members...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div key={m.id} className="p-6 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                    {m.user.firstName?.[0] || "U"}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">
                      {m.user.firstName} {m.user.lastName}
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">{m.user.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge
                    variant={m.role === "OWNER" ? "success" : "neutral"}
                    size="sm"
                  >
                    {m.role.replace(/_/g, " ")}
                  </Badge>

                  {m.role !== "OWNER" && (
                    <button
                      type="button"
                      aria-label={`Remove ${m.user.email} from the team`}
                      onClick={() => handleRemoveMember(m.id)}
                      className="text-rose-600 hover:text-rose-800 p-1 rounded-md"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Pending Invitations ({invitations.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {invitations.map((inv) => (
              <div key={inv.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900">{inv.email}</div>
                  <span className="text-slate-400 text-[11px]">
                    Role: {inv.role} &bull; Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="warning" size="sm">
                    Pending
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => copyInviteLink(inv.inviteUrl)}>
                    Copy link
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRevokeInvite(inv.id)}>
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
