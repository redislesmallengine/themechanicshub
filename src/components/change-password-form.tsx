"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ShieldIcon } from "@/components/icons";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export function ChangePasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (next.length < 8) {
      setMessage({ type: "error", text: "Your new password needs at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setMessage({ type: "error", text: "The new passwords don't match." });
      return;
    }
    if (next === current) {
      setMessage({ type: "error", text: "Choose a new password that's different from your current one." });
      return;
    }
    setSaving(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: signOutOthers,
    });
    setSaving(false);
    if (error) {
      const wrong = error.code === "INVALID_PASSWORD" || /invalid password/i.test(error.message ?? "");
      setMessage({
        type: "error",
        text: wrong ? "Your current password isn't right. Try again." : error.message || "Couldn't change your password. Try again.",
      });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setMessage({ type: "success", text: "Password updated." });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="flex items-center gap-2 pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <span className="p-1 rounded-md bg-brand-50 text-brand-600">
          <ShieldIcon className="w-4 h-4" />
        </span>
        <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
          Change password
        </h3>
      </div>

      <div className="text-xs">
        <label htmlFor="current-password" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          required
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-xs font-medium"
          style={inputStyle}
        />
      </div>

      <div className="text-xs">
        <label htmlFor="new-password" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
          New password
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-xs font-medium"
          style={inputStyle}
        />
        <p className="mt-1" style={{ color: "var(--text-muted)" }}>
          At least 8 characters.
        </p>
      </div>

      <div className="text-xs">
        <label htmlFor="confirm-password" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-xs font-medium"
          style={inputStyle}
        />
      </div>

      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer" style={{ color: "var(--text-secondary)" }}>
        <input type="checkbox" checked={signOutOthers} onChange={(e) => setSignOutOthers(e.target.checked)} />
        Sign me out on other devices
      </label>

      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          className="text-xs font-semibold rounded-lg px-3 py-2"
          style={
            message.type === "error"
              ? { color: "var(--color-error-solid)", background: "var(--color-error-bg, rgba(220,38,38,0.08))" }
              : { color: "var(--color-success-solid, #15803d)", background: "var(--color-success-bg, rgba(21,128,61,0.08))" }
          }
        >
          {message.text}
        </p>
      )}

      <div className="pt-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold"
          style={{ border: "1px solid var(--border-strong)", color: "var(--text-primary)", background: "var(--bg-surface)" }}
        >
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60">
          {saving ? "Saving…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
