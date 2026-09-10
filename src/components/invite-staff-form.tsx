"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { asRole } from "@/lib/permissions";
import type { RoleOption } from "@/lib/rbac";
import { InviteIcon } from "@/components/icons";

export function InviteStaffForm({ roles }: { roles: RoleOption[] }) {
  const router = useRouter();
  const assignable = roles.filter((r) => r.key !== "owner");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(assignable[0]?.key ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const selectedRole = roles.find((r) => r.key === role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.organization.inviteMember({ email, role: asRole(role) });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Couldn't send that invite — check the email and try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Invite a Staff Member
          </h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            They&apos;ll get an email with a link to set up their password and join the shop.
          </p>
        </div>
      </div>

      {sent ? (
        <div
          className="rounded-xl p-6"
          style={{ background: "var(--color-success-subtle)", border: "1px solid var(--color-success-border)", color: "var(--color-success-text)" }}
        >
          <p className="text-sm font-bold mb-1">Invite sent to {email}.</p>
          <p className="text-xs mb-4">They&apos;ll get an email with a link to set up their password and join the shop.</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setSent(false);
                setName("");
                setEmail("");
                setRole(assignable[0]?.key ?? "");
              }}
              className="text-xs font-bold text-brand-600"
            >
              Invite someone else
            </button>
            <button onClick={() => router.push("/staff")} className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Back to staff list
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4"
          style={{ background: "var(--bg-surface)" }}
        >
          <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-brand-50 text-brand-600">
                <InviteIcon className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                New Staff Account (Input Fields)
              </h3>
            </div>
            <span className="text-[11px] text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200 font-mono">
              Invite Form
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label htmlFor="name" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
                Full Name <span style={{ color: "var(--color-error-solid)" }}>*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                placeholder="e.g. Sarah Chiasson"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium transition focus:ring-2 focus:bg-white"
                style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
              />
              <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
                Confirmed by them when they accept the invite.
              </span>
            </div>

            <div>
              <label htmlFor="email" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
                Work Email <span style={{ color: "var(--color-error-solid)" }}>*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="name@redislesmallengine.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium transition focus:ring-2 focus:bg-white"
                style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
              />
              <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
                The invite link goes here.
              </span>
            </div>

            <div>
              <label htmlFor="role" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
                Assigned Role <span style={{ color: "var(--color-error-solid)" }}>*</span>
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
              >
                {assignable.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
                Determines what they can see and do.
              </span>
            </div>
          </div>

          {selectedRole && (
            <div
              className="p-3 rounded-lg text-xs"
              style={{ background: "var(--color-info-subtle)", border: "1px solid var(--color-info-border)", color: "var(--color-info-text)" }}
            >
              <b>{selectedRole.label}</b>
              {selectedRole.description ? <> — {selectedRole.description}</> : null}
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
              {error}
            </p>
          )}

          <div className="pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
              They&apos;ll set their own password when they accept.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/staff")}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-60"
              >
                <InviteIcon className="w-3.5 h-3.5" />
                {loading ? "Sending…" : "Send Invite"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
