"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCustomLineItem, addInventoryLineItem, removeLineItem } from "@/app/(app)/invoices/actions";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export interface InvoiceLine {
  id: string;
  type: string;
  partId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  unitCost: string | null;
  taxable: boolean;
  lineTotal: string;
}

export interface AvailablePart {
  id: string;
  name: string;
  quantityOnHand: number;
  sellPrice: string | null;
}

function AddInventoryLineForm({ invoiceId, availableParts }: { invoiceId: string; availableParts: AvailablePart[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = addInventoryLineItem.bind(null, invoiceId);

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
      <div className="flex-1 min-w-[220px]">
        <label htmlFor="partId" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Part
        </label>
        <select id="partId" name="partId" required defaultValue="" className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
          <option value="" disabled>
            {availableParts.length === 0 ? "No parts in stock" : "Select…"}
          </option>
          {availableParts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — ${p.sellPrice ?? "0.00"} ({p.quantityOnHand} on hand)
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
      <label className="flex items-center gap-1.5 text-[11px] font-semibold pb-2" style={{ color: "var(--text-secondary)" }}>
        <input type="checkbox" name="taxable" defaultChecked className="rounded" style={{ accentColor: "#0F52BA" }} />
        Taxable
      </label>
      <button type="submit" disabled={pending || availableParts.length === 0} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Adding…" : "Add Line"}
      </button>
      {error && (
        <p className="text-xs font-semibold w-full" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
      <p className="text-[10px] w-full" style={{ color: "var(--text-muted)" }}>
        Price comes from the part&apos;s record, and this decrements real stock — the same way adding a part to a Work Order does.
      </p>
    </form>
  );
}

function AddCustomLineForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = addCustomLineItem.bind(null, invoiceId);

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
        <label htmlFor="description" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Description
        </label>
        <input id="description" name="description" type="text" required placeholder="e.g. Shop Supplies" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
      </div>
      <div className="w-20">
        <label htmlFor="quantity" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Qty
        </label>
        <input id="quantity" name="quantity" type="number" step="0.01" min="0.01" defaultValue="1" required className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
      </div>
      <div className="w-28">
        <label htmlFor="unitPrice" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Price ($)
        </label>
        <input id="unitPrice" name="unitPrice" type="number" step="0.01" min="0" required className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
      </div>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold pb-2" style={{ color: "var(--text-secondary)" }}>
        <input type="checkbox" name="taxable" defaultChecked className="rounded" style={{ accentColor: "#0F52BA" }} />
        Taxable
      </label>
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Adding…" : "Add Line"}
      </button>
      {error && (
        <p className="text-xs font-semibold w-full" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </form>
  );
}

function AddLineTabs({ invoiceId, availableParts }: { invoiceId: string; availableParts: AvailablePart[] }) {
  const [tab, setTab] = useState<"inventory" | "custom">(availableParts.length > 0 ? "inventory" : "custom");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 rounded-lg w-fit" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => setTab("inventory")}
          className="px-3 py-1 rounded-md text-[11px] font-bold transition-colors"
          style={tab === "inventory" ? { background: "var(--bg-surface)", color: "var(--text-primary)", boxShadow: "var(--shadow-sm)" } : { color: "var(--text-muted)" }}
        >
          From Inventory
        </button>
        <button
          type="button"
          onClick={() => setTab("custom")}
          className="px-3 py-1 rounded-md text-[11px] font-bold transition-colors"
          style={tab === "custom" ? { background: "var(--bg-surface)", color: "var(--text-primary)", boxShadow: "var(--shadow-sm)" } : { color: "var(--text-muted)" }}
        >
          Type it in
        </button>
      </div>
      {tab === "inventory" ? <AddInventoryLineForm invoiceId={invoiceId} availableParts={availableParts} /> : <AddCustomLineForm invoiceId={invoiceId} />}
    </div>
  );
}

function LineRow({ line, showMargins }: { line: InvoiceLine; showMargins: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    const stockNote = line.partId ? ` This will also restore ${line.quantity} to stock.` : "";
    if (!confirm(`Remove "${line.description}" from this invoice?${stockNote}`)) return;
    startTransition(async () => {
      const result = await removeLineItem(line.id);
      if (result?.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  // A section divider from a combined invoice (one per work order folded
  // in) rather than a priced line -- spans the numeric columns instead of
  // showing zeroed-out qty/price/total.
  if (line.type === "header") {
    return (
      <tr className="dt-row group">
        <td colSpan={showMargins ? 5 : 4} className="dt-td text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)", background: "var(--bg-surface-subtle)" }}>
          {line.description}
        </td>
        <td className="dt-td text-right" style={{ background: "var(--bg-surface-subtle)" }}>
          <button onClick={handleRemove} disabled={pending} className="text-[11px] font-bold disabled:opacity-50" style={{ color: "var(--color-error-solid)" }}>
            {pending ? "…" : "Remove"}
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="dt-row group">
      <td className="dt-td text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {line.description}
        {line.partId && (
          <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: "var(--color-info-text)", background: "var(--color-info-subtle)" }}>
            Inventory
          </span>
        )}
        {!line.taxable && (
          <span className="ml-1.5 text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
            (non-taxable)
          </span>
        )}
      </td>
      <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
        {line.quantity}
      </td>
      <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
        ${line.unitPrice}
      </td>
      {showMargins && (
        <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
          {line.unitCost ? `$${line.unitCost}` : "—"}
        </td>
      )}
      <td className="dt-td num text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        ${line.lineTotal}
      </td>
      <td className="dt-td text-right">
        <button onClick={handleRemove} disabled={pending} className="text-[11px] font-bold disabled:opacity-50" style={{ color: "var(--color-error-solid)" }}>
          {pending ? "…" : "Remove"}
        </button>
      </td>
    </tr>
  );
}

export function InvoiceLineItemsPanel({
  invoiceId,
  lines,
  editable,
  showMargins,
  availableParts,
}: {
  invoiceId: string;
  lines: InvoiceLine[];
  editable: boolean;
  showMargins: boolean;
  availableParts: AvailablePart[];
}) {
  return (
    <div className="space-y-3">
      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table">
            <thead className="dt-head">
              <tr>
                <th className="dt-th text-left">Description</th>
                <th className="dt-th text-left">Qty</th>
                <th className="dt-th text-left">Price</th>
                {showMargins && <th className="dt-th text-left">Cost</th>}
                <th className="dt-th text-left">Total</th>
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={showMargins ? 6 : 5} className="dt-td text-center text-sm py-6" style={{ color: "var(--text-muted)" }}>
                    No line items yet.
                  </td>
                </tr>
              )}
              {lines.map((line) => (
                <LineRow key={line.id} line={line} showMargins={showMargins} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editable && <AddLineTabs invoiceId={invoiceId} availableParts={availableParts} />}
    </div>
  );
}
