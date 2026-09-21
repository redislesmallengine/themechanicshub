"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createWorkOrder } from "@/app/(app)/work-orders/actions";
import { WorkOrderIcon } from "@/components/icons";

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

export function WorkOrderIntakeForm({ customers }: { customers: CustomerWithEquipment[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Checked by default — most drop-offs are "just fix it," not a formal
  // quote request. Staff untick it for the minority of jobs where the
  // customer wants a written estimate before anything starts.
  const [skipEstimate, setSkipEstimate] = useState(true);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createWorkOrder(formData);
      // createWorkOrder redirects on success, so reaching here means it didn't
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-brand-50 text-brand-600">
            <WorkOrderIcon className="w-4 h-4" />
          </span>
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            Intake
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label htmlFor="customerId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Customer <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <select
            id="customerId"
            name="customerId"
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold"
            style={inputStyle}
          >
            <option value="">Select…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `— ${c.phone}` : c.email ? `— ${c.email}` : ""}
              </option>
            ))}
          </select>
          <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
            Don&apos;t see them?{" "}
            <Link href="/customers/new" className="text-brand-600 font-semibold">
              Register a new customer
            </Link>{" "}
            first.
          </span>
        </div>

        <div>
          <label htmlFor="equipmentId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Equipment <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <select id="equipmentId" name="equipmentId" required disabled={!selectedCustomer} className="w-full px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60" style={inputStyle}>
            <option value="">{selectedCustomer ? "Select…" : "Pick a customer first"}</option>
            {selectedCustomer?.equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.label}
              </option>
            ))}
          </select>
          {selectedCustomer && selectedCustomer.equipment.length === 0 && (
            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--color-error-solid)" }}>
              This customer has no equipment registered yet —{" "}
              <Link href={`/customers/${selectedCustomer.id}/equipment/new`} className="font-semibold">
                add one
              </Link>
              .
            </span>
          )}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="complaint" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Complaint <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <textarea id="complaint" name="complaint" required rows={3} placeholder="What the customer says is wrong" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
      </div>

      <div className="rounded-lg p-3" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="skipEstimate"
            checked={skipEstimate}
            onChange={(e) => setSkipEstimate(e.target.checked)}
            className="mt-0.5 rounded"
            style={{ accentColor: "#0F52BA" }}
          />
          <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
            Customer authorized the repair at drop-off (skip formal estimate)
          </span>
        </label>
        <p className="text-[10px] mt-1 ml-6" style={{ color: "var(--text-muted)" }}>
          {skipEstimate
            ? "This work order starts straight in In Repair — no estimate email, no waiting on approval. Untick this if the customer wants a written quote first."
            : "This work order starts in Pending — you'll send a formal estimate for the customer to approve before repair begins."}
        </p>
        {skipEstimate && (
          <div className="mt-3 ml-6 max-w-xs">
            <label htmlFor="notToExceedAmount" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Not-to-exceed amount ($) — optional
            </label>
            <input
              id="notToExceedAmount"
              name="notToExceedAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="Leave blank if open-ended"
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
              style={inputStyle}
            />
            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
              Only fill this in if the customer set a verbal price cap, e.g. &ldquo;call me if it&apos;s over $300.&rdquo;
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}

      <div className="pt-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => router.push("/work-orders")}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60">
          {pending ? "Creating…" : skipEstimate ? "Create Work Order — Start Repair" : "Create Work Order"}
        </button>
      </div>
    </form>
  );
}
