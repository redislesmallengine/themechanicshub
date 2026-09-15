"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateInvoiceParty } from "@/app/(app)/invoices/actions";

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

export function InvoicePartyForm({
  invoiceId,
  customers,
  initialCustomerId,
  initialEquipmentId,
  initialAdHocEquipmentLabel,
}: {
  invoiceId: string;
  customers: CustomerWithEquipment[];
  initialCustomerId: string;
  initialEquipmentId: string;
  initialAdHocEquipmentLabel: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [equipmentId, setEquipmentId] = useState(initialEquipmentId);
  const [adHocEquipmentLabel, setAdHocEquipmentLabel] = useState(initialAdHocEquipmentLabel);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = updateInvoiceParty.bind(null, invoiceId);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "Saved." });
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <label htmlFor="customerId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Customer — optional
          </label>
          <select
            id="customerId"
            name="customerId"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setEquipmentId(""); // the previously-picked equipment may not belong to the newly-picked customer
            }}
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
        </div>

        <div>
          <label htmlFor="equipmentId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Equipment — optional
          </label>
          <select
            id="equipmentId"
            name="equipmentId"
            value={equipmentId}
            disabled={!selectedCustomer || !!adHocEquipmentLabel}
            onChange={(e) => setEquipmentId(e.target.value)}
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
          {selectedCustomer && selectedCustomer.equipment.length === 0 && (
            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
              This customer has no equipment registered yet —{" "}
              <Link href={`/customers/${selectedCustomer.id}/equipment/new`} className="font-semibold text-brand-600">
                add one
              </Link>
              .
            </span>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="adHocEquipmentLabel" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Or describe the machine — no record on file
        </label>
        <input
          id="adHocEquipmentLabel"
          name="adHocEquipmentLabel"
          type="text"
          value={adHocEquipmentLabel}
          disabled={!!equipmentId}
          onChange={(e) => setAdHocEquipmentLabel(e.target.value)}
          placeholder="e.g. Toro 20370 mower, borrowed — no equipment record"
          className="w-full px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-60"
          style={inputStyle}
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        {message && (
          <span className="text-[11px] font-semibold" style={{ color: message.type === "error" ? "var(--color-error-solid)" : "var(--color-success-solid)" }}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
