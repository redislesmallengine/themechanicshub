"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createWorkOrder } from "@/app/(app)/work-orders/actions";
import { WorkOrderIcon } from "@/components/icons";
import { DROP_OFF_METHOD_LABELS, type DropOffMethod } from "@/lib/work-orders";

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

function SegmentedToggle<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-strong)" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="px-4 py-2 text-xs font-bold transition"
          style={opt.value === value ? { background: "var(--color-brand-600)", color: "#fff" } : { background: "var(--bg-surface)", color: "var(--text-secondary)" }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function WorkOrderIntakeForm({
  customers,
  initialCustomerId,
  initialEquipmentId,
}: {
  customers: CustomerWithEquipment[];
  initialCustomerId?: string;
  initialEquipmentId?: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [equipmentId, setEquipmentId] = useState(initialEquipmentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dropOffMethod, setDropOffMethod] = useState<DropOffMethod>("customerDropOff");
  // true ("No pre-approval needed") is the common case — most drop-offs are
  // "just fix it," not a formal quote request. Staff flip to "Yes" for the
  // minority of jobs where the customer wants a written estimate first.
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
    <form action={handleSubmit} className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-5" style={{ background: "var(--bg-surface)" }}>
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

      {/* The two questions that decide everything else about this work order — answered first, before any of the lookup fields below. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>
            How&apos;s this coming in?
          </div>
          <input type="hidden" name="dropOffMethod" value={dropOffMethod} />
          <SegmentedToggle
            value={dropOffMethod}
            onChange={setDropOffMethod}
            options={[
              { value: "customerDropOff", label: DROP_OFF_METHOD_LABELS.customerDropOff },
              { value: "pickupDelivery", label: DROP_OFF_METHOD_LABELS.pickupDelivery },
            ]}
          />
          {dropOffMethod === "pickupDelivery" && (
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              Generate Invoice will suggest your delivery fee for this one.
            </p>
          )}
        </div>

        <div>
          <div className="text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Need pre-approval with a written estimate first?
          </div>
          {skipEstimate && <input type="hidden" name="skipEstimate" value="on" />}
          <SegmentedToggle
            value={skipEstimate ? "no" : "yes"}
            onChange={(v) => setSkipEstimate(v === "no")}
            options={[
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
            ]}
          />
          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
            {skipEstimate ? "Straight to In Repair — no estimate email, no waiting on approval." : "Starts in Pending — you'll send a formal estimate to approve before repair begins."}
          </p>
        </div>
      </div>

      {skipEstimate && (
        <div className="max-w-xs">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div>
          <label htmlFor="customerId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Customer <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <select
            id="customerId"
            name="customerId"
            required
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setEquipmentId("");
            }}
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
          <select
            id="equipmentId"
            name="equipmentId"
            required
            disabled={!selectedCustomer}
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
            style={inputStyle}
          >
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
