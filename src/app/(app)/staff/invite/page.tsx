"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import { InviteIcon } from "@/components/icons";

const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  owner: "Full control: billing, staff, settings, and financial reports.",
  manager: "Full operational control — invoices, inventory, expenses, work orders. Not billing.",
  technician: "Create and edit work orders and invoices, look up parts. Can't void invoices, change settings, or see profit margins.",
  bookkeeper: "Invoices, payments, expenses, receipt OCR, tax reports. Not shop-floor workflows.",
  frontdesk: "Customer status and equipment intake lookup only.",
};

export default function InviteStaffPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleKey>("technician");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.organization.inviteMember({ email, role });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Couldn't send that invite — check the email and try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="p-8 md:p-10 max-w-2xl mx-auto">
        <div
          className="rounded-lg p-6 text-sm"
          style={{ background: "var(--color-success-subtle)", border: "1px solid var(--color-success-border)", color: "var(--color-success-text)" }}
        >
          <b>Invite sent to {email}.</b> They&apos;ll get an email with a link to set up their password and join the shop.
        </div>
        <button
          onClick={() => {
            setSent(false);
            setName("");
            setEmail("");
            setRole("technician");
          }}
          className="mt-4 text-sm font-semibold text-brand-600"
        >
          Invite someone else
        </button>
        <button onClick={() => router.push("/staff")} className="ml-6 mt-4 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Back to staff list
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: "var(--color-info-subtle)", color: "var(--color-info-solid)" }}
          >
            <InviteIcon className="w-4.5 h-4.5" />
          </span>
          <h1 className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            Invite a staff member
          </h1>
        </div>
        <p className="text-sm mb-8 ml-11" style={{ color: "var(--text-secondary)" }}>
          They&apos;ll get an email with a link to set up their password and join the shop.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-2 gap-x-5 gap-y-5">
            <div>
              <label htmlFor="name" className="block font-semibold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Full name
              </label>
              <input
                id="name"
                type="text"
                placeholder="e.g. Sarah Chiasson"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                They&apos;ll confirm this themselves when they accept — just here so you remember who you invited.
              </p>
            </div>
            <div>
              <label htmlFor="email" className="block font-semibold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Work email <span style={{ color: "var(--color-error-solid)" }}>*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="name@redislesmallengine.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="role" className="block font-semibold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Role <span style={{ color: "var(--color-error-solid)" }}>*</span>
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as RoleKey)}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
              >
                {(Object.keys(ROLE_LABELS) as RoleKey[]).map((key) => (
                  <option key={key} value={key}>
                    {ROLE_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="mt-5 p-4 rounded-lg text-sm"
            style={{ background: "var(--color-info-subtle)", border: "1px solid var(--color-info-border)", color: "var(--color-info-text)" }}
          >
            <b>{ROLE_LABELS[role]}</b> — {ROLE_DESCRIPTIONS[role]}
          </div>

          {error && (
            <p className="text-sm mt-4 font-medium" style={{ color: "var(--color-error-solid)" }}>
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 mt-8 pt-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send Invite"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/staff")}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border-strong)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
