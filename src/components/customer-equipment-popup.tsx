"use client";

import { useState } from "react";
import { EquipmentMiniList, type MiniEquipment } from "@/components/equipment-mini-list";

export function CustomerEquipmentPopup({ customerId, customerName, equipment }: { customerId: string; customerName: string; equipment: MiniEquipment[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="font-semibold text-brand-600 hover:underline">
        {equipment.length}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {customerName}&apos;s Equipment
              </h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                Close ✕
              </button>
            </div>
            <EquipmentMiniList customerId={customerId} equipment={equipment} />
          </div>
        </div>
      )}
    </>
  );
}
