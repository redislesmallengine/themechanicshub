"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { WrenchIcon } from "@/components/icons";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    if (!token) {
      setError("This reset link is missing its token — request a new one.");
      return;
    }
    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Couldn't reset your password — the link may have expired.");
      return;
    }
    setDone(true);
  }

  const invalidLink = linkError === "INVALID_TOKEN" || !token;

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

        {done ? (
          <>
            <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
              Password updated
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
              Sign in with your new password.
            </p>
            <button
              onClick={() => router.push("/sign-in")}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600"
            >
              Go to Sign In
            </button>
          </>
        ) : invalidLink ? (
          <>
            <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
              Link expired
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
              This password reset link is invalid or has expired — they&apos;re only good for an hour. Request a new one.
            </p>
            <a href="/forgot-password" className="block w-full text-center py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600">
              Request a New Link
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
              Set a new password
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
              Choose a new password for your account.
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="password" className="block font-semibold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                New Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mb-4 px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
              />

              <label htmlFor="confirm" className="block font-semibold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Confirm New Password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full mb-2 px-3 py-2.5 rounded-lg text-sm"
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
                className="w-full mt-4 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 disabled:opacity-60"
              >
                {loading ? "Saving…" : "Set New Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
