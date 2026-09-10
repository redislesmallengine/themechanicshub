"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/app/(app)/customers/actions";
import { CustomersIcon } from "@/components/icons";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export function CustomerForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCustomer(formData);
      // createCustomer redirects on success, so reaching here at all means it didn't
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-brand-50 text-brand-600">
            <CustomersIcon className="w-4 h-4" />
          </span>
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            New Customer
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="md:col-span-2">
          <label htmlFor="name" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Full Name <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <input id="name" name="name" type="text" required placeholder="e.g. Sarah Chiasson" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="phone" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Phone
          </label>
          <input id="phone" name="phone" type="tel" placeholder="(902) 555-0100" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="email" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Email
          </label>
          <input id="email" name="email" type="email" placeholder="name@example.com" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="notes" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Notes
          </label>
          <textarea id="notes" name="notes" rows={2} placeholder="Anything worth flagging for next time" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
      </div>

      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        At least a phone number or email is required — that&apos;s what front desk searches by.
      </p>

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}

      <div className="pt-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => router.push("/customers")}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60">
          {pending ? "Creating…" : "Create Customer"}
        </button>
      </div>
    </form>
  );
}
