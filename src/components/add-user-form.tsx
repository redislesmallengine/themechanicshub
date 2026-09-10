"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addUserDirectly } from "@/app/(app)/staff/actions";
import type { RoleOption } from "@/lib/rbac";
import { InviteIcon } from "@/components/icons";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export function AddUserForm({ roles }: { roles: RoleOption[] }) {
  const router = useRouter();
  const [role, setRole] = useState(roles.find((r) => r.key !== "owner")?.key ?? roles[0]?.key ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ email: string; password?: string; existingAccount?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addUserDirectly(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.success) setResult({ email: res.email, password: res.password, existingAccount: res.existingAccount });
    });
  }

  async function copyPassword() {
    if (!result?.password) return;
    try {
      await navigator.clipboard.writeText(result.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the password is still visible to select/copy manually
    }
  }

  if (result) {
    return (
      <div className="rounded-xl p-6" style={{ background: "var(--color-success-subtle)", border: "1px solid var(--color-success-border)", color: "var(--color-success-text)" }}>
        <p className="text-sm font-bold mb-1">{result.existingAccount ? `${result.email} was added to this shop.` : `Account created for ${result.email}.`}</p>

        {result.password && (
          <>
            <p className="text-xs mb-3">
              This password is shown <b>once</b> — copy it and give it to them directly (in person, chat, whatever&apos;s convenient). They should change
              it after signing in.
            </p>
            <div className="flex items-center gap-2 mb-4">
              <code
                className="flex-1 px-3 py-2 rounded-lg text-sm font-mono font-bold"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
              >
                {result.password}
              </code>
              <button
                type="button"
                onClick={copyPassword}
                className="px-3 py-2 rounded-lg text-xs font-semibold shrink-0"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setResult(null);
              setError(null);
            }}
            className="text-xs font-bold text-brand-600"
          >
            Add another
          </button>
          <button onClick={() => router.push("/staff")} className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Back to staff list
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-brand-50 text-brand-600">
            <InviteIcon className="w-4 h-4" />
          </span>
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            New Staff Account
          </h3>
        </div>
        <span className="text-[11px] text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200 font-mono">Add Directly</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <label htmlFor="name" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Full Name <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <input id="name" name="name" type="text" required placeholder="e.g. Sarah Chiasson" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="email" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Work Email <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <input id="email" name="email" type="email" required placeholder="name@redislesmallengine.com" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="role" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Assigned Role <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
            {roles
              .filter((r) => r.key !== "owner")
              .map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div
        className="p-3 rounded-lg text-xs"
        style={{ background: "var(--color-info-subtle)", border: "1px solid var(--color-info-border)", color: "var(--color-info-text)" }}
      >
        A temporary password is generated for them and shown to you once on the next screen — no invite email is sent.
      </div>

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}

      <div className="pt-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => router.push("/staff")}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-60">
          <InviteIcon className="w-3.5 h-3.5" />
          {pending ? "Creating…" : "Create Account"}
        </button>
      </div>
    </form>
  );
}
