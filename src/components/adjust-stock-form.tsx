"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustStock } from "@/app/(app)/inventory/actions";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

const REASONS = ["Restock", "Correction", "Damaged/Lost", "Return to Supplier", "Other"];

export function AdjustStockForm({
  partId,
  currentQuantity,
  currentCostPrice,
  currentSellPrice,
  onSuccess,
}: {
  partId: string;
  currentQuantity: number;
  currentCostPrice: string | null;
  currentSellPrice: string | null;
  /** Only set by callers that render this inside something dismissible, e.g. AdjustStockPopup — the part detail page just leaves it unset and relies on router.refresh() alone. */
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Controlled only so the price fields below can show/hide themselves —
  // everything else about this form stays as plain uncontrolled inputs.
  const [reason, setReason] = useState("");
  const boundAdjust = adjustStock.bind(null, partId);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await boundAdjust(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      setReason("");
      router.refresh();
      onSuccess?.();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div>
          <label htmlFor="delta" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Change ({currentQuantity} on hand)
          </label>
          <input id="delta" name="delta" type="number" step="1" required placeholder="+20 or -3" className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="reason" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Reason
          </label>
          <select
            id="reason"
            name="reason"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold"
            style={inputStyle}
          >
            <option value="" disabled>
              Select…
            </option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="note" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Note
          </label>
          <input id="note" name="note" type="text" placeholder="Optional" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
      </div>

      {reason === "Restock" && (
        <div className="rounded-lg p-3" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-xs font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Did the price change with this restock? — optional
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="newCostPrice" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                New Cost Price ($)
              </label>
              <input
                id="newCostPrice"
                name="newCostPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder={currentCostPrice ? `Currently $${currentCostPrice}` : "Not set"}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="newSellPrice" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                New Sell Price ($)
              </label>
              <input
                id="newSellPrice"
                name="newSellPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder={currentSellPrice ? `Currently $${currentSellPrice}` : "Not set"}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono"
                style={inputStyle}
              />
            </div>
          </div>
          <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
            Leave either blank to keep it as-is. Updating a price here only applies going forward — any work order or
            invoice line that already used this part keeps the price it had at the time.
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {pending ? "Saving…" : "Adjust Stock"}
        </button>
      </div>
    </form>
  );
}
