"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { WrenchIcon } from "@/components/icons";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Couldn't sign you in — check your email and password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-app)" }}>
      <div
        className="w-full max-w-4xl grid md:grid-cols-[1fr_1.35fr] rounded-xl overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
      >
        {/* Brand panel */}
        <div className="hidden md:flex flex-col justify-between p-10" style={{ background: "#0F172A" }}>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600">
              <WrenchIcon className="w-4.5 h-4.5 text-white" />
            </span>
            <span className="text-white font-extrabold tracking-tight text-sm">MECHANIC SHOP HUB</span>
          </div>
          <div>
            <h2 className="text-white text-3xl font-extrabold leading-tight mb-3" style={{ textWrap: "balance" }}>
              Run the whole shop from one ticket board.
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-[34ch]">
              Intake, diagnostics, parts, invoicing, and payment — one system for the whole crew.
            </p>
          </div>
          <div className="font-mono text-[11px] tracking-wider uppercase text-slate-500">
            Red Isle Small Engine &middot; Prince Edward Island
          </div>
        </div>

        {/* Form panel */}
        <div className="p-10 md:p-14 flex flex-col justify-center">
          <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
            Sign in to your shop
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
            Enter your work email and password.
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

            <label htmlFor="password" className="block font-semibold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mb-2 px-3 py-2.5 rounded-lg text-sm"
              style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
            />

            {error && (
              <p className="text-xs mt-2 mb-2 font-medium" style={{ color: "var(--color-error-solid)" }}>
                {error}
              </p>
            )}

            <div className="flex items-center justify-end mb-6 mt-3">
              <a href="/forgot-password" className="text-xs font-semibold text-brand-600">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p
            className="text-xs mt-6 pt-5 text-center"
            style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)" }}
          >
            New to the shop? Ask your owner or manager for an invite.
          </p>
        </div>
      </div>
    </div>
  );
}
