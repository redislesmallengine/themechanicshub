"use client";

import { useState } from "react";
import { WrenchIcon } from "@/components/icons";
import { registerShop } from "./actions";

export default function SignUpPage() {
  const [shopName, setShopName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // The shop is created on the server and starts out waiting for the site administrator's approval,
    // so nobody is signed in afterwards -- they sign in once it has been approved.
    const result = await registerShop({ shopName, name, email, password }).catch(() => ({ error: "Something went wrong. Please try again." }));
    setLoading(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-app)" }}>
        <div className="w-full max-w-md rounded-xl p-8 md:p-10 text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}>
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-4" style={{ background: "var(--color-success-subtle)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-success-solid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>
            Thanks, {shopName}
          </h1>
          <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
            Your sign-up is in. We review every new shop before it opens, so you can&apos;t sign in just yet.
          </p>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            You&apos;ll get an email at <b>{email}</b> as soon as it&apos;s approved.
          </p>
          <a href="/sign-in" className="text-sm font-semibold text-brand-600">
            Back to sign in
          </a>
        </div>
      </div>
    );
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

        <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
          Set up your shop
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          This creates your Owner account and your shop&apos;s workspace. New shops are approved before they can sign in.
        </p>

        <form onSubmit={handleSubmit}>
          {[
            { id: "shopName", label: "Shop name", type: "text", value: shopName, set: setShopName, placeholder: "Red Isle Small Engine" },
            { id: "name", label: "Your name", type: "text", value: name, set: setName, placeholder: "Junaid" },
            { id: "email", label: "Email", type: "email", value: email, set: setEmail, placeholder: "you@yourshop.com" },
            { id: "password", label: "Password", type: "password", value: password, set: setPassword, placeholder: "" },
          ].map((f) => (
            <div key={f.id} className="mb-4">
              <label htmlFor={f.id} className="block font-semibold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {f.label}
              </label>
              <input
                id={f.id}
                type={f.type}
                required
                placeholder={f.placeholder}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
              />
            </div>
          ))}

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
            {loading ? "Setting up…" : "Create Shop"}
          </button>
        </form>

        <p className="text-xs mt-6 pt-5 text-center" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)" }}>
          Already have an account?{" "}
          <a href="/sign-in" className="font-semibold text-brand-600">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
