"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { WrenchIcon } from "@/components/icons";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function SignUpPage() {
  const router = useRouter();
  const [shopName, setShopName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const signUpResult = await authClient.signUp.email({ email, password, name });
    if (signUpResult.error) {
      setLoading(false);
      setError(signUpResult.error.message ?? "Couldn't create that account.");
      return;
    }

    const orgResult = await authClient.organization.create({
      name: shopName,
      slug: `${slugify(shopName)}-${Math.random().toString(36).slice(2, 6)}`,
    });
    setLoading(false);
    if (orgResult.error) {
      setError(
        orgResult.error.message ??
          "Your account was created, but setting up the shop failed — try signing in and creating it from settings."
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
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
          This creates your Owner account and your shop&apos;s workspace.
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
