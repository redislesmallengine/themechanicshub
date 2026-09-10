"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addWorkOrderPart, removeWorkOrderPart } from "@/app/(app)/work-orders/actions";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

interface PartLine {
  id: string;
  name: string;
  quantity: number;
  unitSellPrice: string | null;
}

function AddPartForm({ workOrderId, availableParts }: { workOrderId: string; availableParts: { id: string; name: string; quantityOnHand: number }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = addWorkOrderPart.bind(null, workOrderId);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="flex items-end gap-2 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <label htmlFor="partId" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Part
        </label>
        <select id="partId" name="partId" required defaultValue="" className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
          <option value="" disabled>
            Select…
          </option>
          {availableParts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.quantityOnHand} on hand)
            </option>
          ))}
        </select>
      </div>
      <div className="w-20">
        <label htmlFor="quantity" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Qty
        </label>
        <input id="quantity" name="quantity" type="number" step="1" min="1" defaultValue="1" required className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
      </div>
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Adding…" : "Add Part"}
      </button>
      {error && (
        <p className="text-xs font-semibold w-full" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </form>
  );
}

function PartRow({ line }: { line: PartLine }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    if (!confirm(`Remove ${line.name} from this work order? The stock it used will be put back.`)) return;
    startTransition(async () => {
      const result = await removeWorkOrderPart(line.id);
      if (result?.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <tr className="dt-row group">
      <td className="dt-td text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {line.name}
      </td>
      <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
        {line.quantity}
      </td>
      <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
        {line.unitSellPrice ? `$${line.unitSellPrice}` : "—"}
      </td>
      <td className="dt-td text-right">
        <button onClick={handleRemove} disabled={pending} className="text-[11px] font-bold disabled:opacity-50" style={{ color: "var(--color-error-solid)" }}>
          {pending ? "…" : "Remove"}
        </button>
      </td>
    </tr>
  );
}

export function WorkOrderPartsPanel({
  workOrderId,
  parts,
  availableParts,
}: {
  workOrderId: string;
  parts: PartLine[];
  availableParts: { id: string; name: string; quantityOnHand: number }[];
}) {
  return (
    <div className="space-y-3">
      {parts.length > 0 && (
        <div className="dt-container">
          <div className="dt-scroll">
            <table className="dt-table">
              <thead className="dt-head">
                <tr>
                  <th className="dt-th text-left">Part</th>
                  <th className="dt-th text-left">Qty</th>
                  <th className="dt-th text-left">Sell Price</th>
                  <th className="dt-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((line) => (
                  <PartRow key={line.id} line={line} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {availableParts.length > 0 ? (
        <AddPartForm workOrderId={workOrderId} availableParts={availableParts} />
      ) : (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No parts in stock —{" "}
          <Link href="/inventory/new" className="text-brand-600 font-semibold">
            add some to Inventory
          </Link>{" "}
          first.
        </p>
      )}
    </div>
  );
}
