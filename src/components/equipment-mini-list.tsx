import Link from "next/link";
import { EquipmentIcon } from "@/components/icons";
import { DeleteEquipmentButton } from "@/components/delete-equipment-button";

export interface MiniEquipment {
  id: string;
  label: string;
  typeName: string | null;
  serialNumber: string | null;
  photoKey: string | null;
}

/**
 * Compact equipment list — reused inline on a customer's view/edit page and
 * inside the equipment-count popup on the Customers list, so "edit/delete/
 * add more" behaves identically no matter where you reach it from.
 */
export function EquipmentMiniList({
  customerId,
  equipment,
  showAddLink = true,
}: {
  customerId: string;
  equipment: MiniEquipment[];
  showAddLink?: boolean;
}) {
  return (
    <div className="space-y-2">
      {equipment.length === 0 && (
        <div className="rounded-lg p-4 text-center text-xs" style={{ background: "var(--bg-surface-subtle)", border: "1px dashed var(--border-strong)", color: "var(--text-muted)" }}>
          No equipment registered yet.
        </div>
      )}
      {equipment.map((eq) => (
        <div key={eq.id} className="flex items-center justify-between gap-3 rounded-lg p-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <Link href={`/equipment/${eq.id}`} className="flex items-center gap-3 min-w-0 hover:underline">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 overflow-hidden"
              style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)" }}
            >
              {eq.photoKey ? (
                // eslint-disable-next-line @next/next/no-img-element -- streamed via /api/equipment-photo
                <img src={`/api/equipment-photo/${eq.id}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <EquipmentIcon className="w-4 h-4 text-indigo-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                {eq.label}
              </div>
              <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                {eq.typeName ?? "Uncategorized"}
                {eq.serialNumber ? ` · S/N ${eq.serialNumber}` : ""}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            <Link href={`/equipment/${eq.id}/edit`} className="text-[11px] font-bold text-brand-600">
              Edit
            </Link>
            <DeleteEquipmentButton equipmentId={eq.id} label={eq.label} />
          </div>
        </div>
      ))}
      {showAddLink && (
        <Link href={`/customers/${customerId}/equipment/new`} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 mt-1">
          + Add more equipment
        </Link>
      )}
    </div>
  );
}
