"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { WrenchIcon } from "@/components/icons";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Couldn't send that reset link — try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-app)" }}>
      <div
        className="w-full max-w-md rounded-xl p-8 md:p-10"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
      >
        <div className="flex items-center gap-2.5 mb-8">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600">
            <WrenchIcon className="w-4.5 h-4.5 text-white" />
          </span>
          <span className="font-extrabold tracking-tight text-sm" style={{ color: "var(--text-primary)" }}>
            MECHANIC SHOP HUB
          </span>
        </div>

        {sent ? (
          <>
            <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
              Check your email
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
              If <b>{email}</b> has an account, a reset link is on its way. It expires in an hour — request a new one if it doesn&apos;t
              show up in a few minutes (check spam too).
            </p>
            <a href="/sign-in" className="text-xs font-semibold text-brand-600">
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
              Reset your password
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
              Enter your work email and we&apos;ll send you a link to set a new one.
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="email" className="block font-semibold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mb-4 px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
              />

              {error && (
                <p className="text-xs mt-2 mb-2 font-medium" style={{ color: "var(--color-error-solid)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>

            <p className="text-xs mt-6 pt-5 text-center" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)" }}>
              <a href="/sign-in" className="font-semibold text-brand-600">
                Back to sign in
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
