"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addWorkOrderPart } from "@/app/(app)/work-orders/actions";
import { SearchSelect } from "@/components/search-select";
import { secondaryButton } from "@/lib/ui";

export interface AvailablePart {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  quantityOnHand: number;
}

/**
 * "Pick a part from inventory and how many": adds it to the job (taking it out of stock) and refreshes the page,
 * so it shows up as a row. Used on the Repairing step and on the Billing screen.
 */
export function AddPartPicker({ workOrderId, availableParts, onDone }: { workOrderId: string; availableParts: AvailablePart[]; onDone?: () => void }) {
  const router = useRouter();
  const [partId, setPartId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (availableParts.length === 0) {
    return (
      <p className="text-sm font-semibold">
        There are no parts in stock.{" "}
        <Link href="/inventory/new" className="text-brand-600 underline">
          Add some to Inventory
        </Link>{" "}
        first.
      </p>
    );
  }

  function add() {
    setError(null);
    if (!partId) {
      setError("Pick a part first.");
      return;
    }
    const fd = new FormData();
    fd.set("partId", partId);
    fd.set("quantity", quantity);
    startTransition(async () => {
      const result = await addWorkOrderPart(workOrderId, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setPartId("");
      setQuantity("1");
      router.refresh();
      onDone?.();
    });
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-surface)", border: "2px solid var(--text-primary)" }}>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[14rem]">
          <label htmlFor="add-part-search" className="block font-bold mb-1 text-sm">
            Part
          </label>
          <SearchSelect
            id="add-part-search"
            value={partId}
            onChange={setPartId}
            placeholder="Type a part name or number…"
            options={availableParts.map((p) => ({ value: p.id, label: p.name, code: p.sku ?? undefined, keywords: p.barcode ?? "", hint: `${p.quantityOnHand} on hand` }))}
          />
        </div>
        <div className="w-24">
          <label htmlFor="add-part-qty" className="block font-bold mb-1 text-sm">
            How many
          </label>
          <input id="add-part-qty" type="number" step="1" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full px-3 py-2 rounded-lg font-mono" />
        </div>
        <button type="button" onClick={add} disabled={pending} className="px-5 py-2.5 rounded-lg text-lg font-extrabold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {pending ? "Adding…" : "Add"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className={secondaryButton}>
            Cancel
          </button>
        )}
      </div>
      {error && (
        <p className="text-sm font-bold" style={{ color: "var(--color-error-solid)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
