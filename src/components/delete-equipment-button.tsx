"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEquipment } from "@/app/(app)/equipment/actions";

export function DeleteEquipmentButton({
  equipmentId,
  label,
  redirectTo,
}: {
  equipmentId: string;
  label: string;
  /** Detail page passes its customer's URL; the list page omits this and just refreshes in place. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete ${label}? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteEquipment(equipmentId);
      if (result?.error) {
        alert(result.error);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <button onClick={handleDelete} disabled={pending} className="text-xs font-semibold disabled:opacity-50" style={{ color: "var(--color-error-solid)" }}>
      {pending ? "…" : "Delete"}
    </button>
  );
}
