"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createStandaloneInvoice } from "@/app/(app)/invoices/actions";
import { InvoiceIcon } from "@/components/icons";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

interface CustomerWithEquipment {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  equipment: { id: string; label: string }[];
}

export function NewInvoiceForm({ customers }: { customers: CustomerWithEquipment[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createStandaloneInvoice(formData);
      // createStandaloneInvoice redirects on success, so reaching here means it didn't
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-brand-50 text-brand-600">
            <InvoiceIcon className="w-4 h-4" />
          </span>
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            New Invoice
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label htmlFor="customerId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Customer — optional
          </label>
          <select
            id="customerId"
            name="customerId"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold"
            style={inputStyle}
          >
            <option value="">No customer (walk-in / cash sale)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `— ${c.phone}` : c.email ? `— ${c.email}` : ""}
              </option>
            ))}
          </select>
          <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
            Leave blank for a counter sale — the invoice will show &ldquo;No Customer Info&rdquo; in place of a name.
          </span>
        </div>

        <div>
          <label htmlFor="equipmentId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Equipment — optional
          </label>
          <select
            id="equipmentId"
            name="equipmentId"
            disabled={!selectedCustomer}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
            style={inputStyle}
          >
            <option value="">{selectedCustomer ? "Parts only — no equipment" : "Pick a customer first"}</option>
            {selectedCustomer?.equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.label}
              </option>
            ))}
          </select>
          {selectedCustomer ? (
            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
              Only fill this in if there&apos;s a repair on this invoice.{" "}
              {selectedCustomer.equipment.length === 0 && (
                <>
                  This customer has no equipment registered yet —{" "}
                  <Link href={`/customers/${selectedCustomer.id}/equipment/new`} className="font-semibold text-brand-600">
                    add one
                  </Link>
                  .
                </>
              )}
            </span>
          ) : (
            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
              Leave blank for a plain parts sale — no machine involved.
            </span>
          )}
        </div>
      </div>

      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        Line items — parts, labour, fees — are added on the next screen. No equipment picked = a Parts Only invoice; equipment
        picked = an Equipment Repair Service invoice, with machine details shown on it.
      </p>

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}

      <div className="pt-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => router.push("/invoices")}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60">
          {pending ? "Creating…" : "Create Invoice"}
        </button>
      </div>
    </form>
  );
}
