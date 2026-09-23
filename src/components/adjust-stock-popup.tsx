"use client";

import { useState } from "react";
import { AdjustStockForm } from "@/components/adjust-stock-form";

export function AdjustStockPopup({
  partId,
  partName,
  currentQuantity,
  currentCostPrice,
  currentSellPrice,
}: {
  partId: string;
  partName: string;
  currentQuantity: number;
  currentCostPrice: string | null;
  currentSellPrice: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] font-bold text-brand-600">
        Adjust Stock
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl p-7"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Adjust Stock — {partName}
              </h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                Close ✕
              </button>
            </div>
            <AdjustStockForm
              partId={partId}
              currentQuantity={currentQuantity}
              currentCostPrice={currentCostPrice}
              currentSellPrice={currentSellPrice}
              onSuccess={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
