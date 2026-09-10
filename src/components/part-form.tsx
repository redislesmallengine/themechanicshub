"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPart } from "@/app/(app)/inventory/actions";
import { InventoryIcon } from "@/components/icons";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

type ActionResult = { success?: boolean; error?: string } | undefined;

export function PartForm({
  mode = "create",
  categories,
  initialCategoryId = "",
  initialName = "",
  initialSku = "",
  initialBarcode = "",
  initialBinLocation = "",
  initialCostPrice = "",
  initialSellPrice = "",
  initialReorderPoint = "0",
  initialNotes = "",
  cancelHref = "/inventory",
  onSubmit = createPart,
}: {
  mode?: "create" | "edit";
  categories: { id: string; name: string }[];
  initialCategoryId?: string;
  initialName?: string;
  initialSku?: string;
  initialBarcode?: string;
  initialBinLocation?: string;
  initialCostPrice?: string;
  initialSellPrice?: string;
  initialReorderPoint?: string;
  initialNotes?: string;
  cancelHref?: string;
  onSubmit?: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(formData);
      // both createPart and updatePart redirect on success, so reaching here means it didn't
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-brand-50 text-brand-600">
            <InventoryIcon className="w-4 h-4" />
          </span>
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            {mode === "create" ? "New Part" : "Edit Part"}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="md:col-span-2">
          <label htmlFor="name" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Name <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <input id="name" name="name" type="text" required defaultValue={initialName} placeholder="e.g. Spark Plug — NGK BPR6ES" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="categoryId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Category
          </label>
          <select id="categoryId" name="categoryId" defaultValue={initialCategoryId} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sku" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            SKU
          </label>
          <input id="sku" name="sku" type="text" defaultValue={initialSku} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="barcode" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Barcode
          </label>
          <input id="barcode" name="barcode" type="text" defaultValue={initialBarcode} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="binLocation" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Bin Location
          </label>
          <input id="binLocation" name="binLocation" type="text" defaultValue={initialBinLocation} placeholder="A3-12" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>

        <div>
          <label htmlFor="costPrice" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Cost Price ($)
          </label>
          <input id="costPrice" name="costPrice" type="number" step="0.01" min="0" defaultValue={initialCostPrice} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="sellPrice" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Sell Price ($)
          </label>
          <input id="sellPrice" name="sellPrice" type="number" step="0.01" min="0" defaultValue={initialSellPrice} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="reorderPoint" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Reorder Point
          </label>
          <input id="reorderPoint" name="reorderPoint" type="number" step="1" min="0" defaultValue={initialReorderPoint} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
        </div>

        {mode === "create" && (
          <div>
            <label htmlFor="startingQuantity" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Starting Quantity
            </label>
            <input id="startingQuantity" name="startingQuantity" type="number" step="1" min="0" defaultValue="0" className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
              Logged as a &ldquo;Restock&rdquo; adjustment. Use Adjust Stock afterward to change it.
            </span>
          </div>
        )}
        <div className={mode === "create" ? "md:col-span-2" : "md:col-span-3"}>
          <label htmlFor="notes" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Notes
          </label>
          <input id="notes" name="notes" type="text" defaultValue={initialNotes} className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
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
          onClick={() => router.push(cancelHref)}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60">
          {pending ? "Saving…" : mode === "create" ? "Create Part" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
