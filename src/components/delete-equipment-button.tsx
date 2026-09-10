"use client";

import { useTransition } from "react";
import { deleteEquipment } from "@/app/(app)/equipment/actions";

export function DeleteEquipmentButton({ equipmentId, label }: { equipmentId: string; label: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete ${label}? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteEquipment(equipmentId);
      // deleteEquipment redirects on success, so reaching here means it didn't
      if (result?.error) alert(result.error);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-xs font-semibold disabled:opacity-50"
      style={{ color: "var(--color-error-solid)" }}
    >
      {pending ? "Deleting…" : "Delete Equipment"}
    </button>
  );
}
