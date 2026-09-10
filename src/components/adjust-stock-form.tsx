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

export function AdjustStockForm({ partId, currentQuantity }: { partId: string; currentQuantity: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
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
      router.refresh();
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
          <select id="reason" name="reason" required defaultValue="" className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
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
