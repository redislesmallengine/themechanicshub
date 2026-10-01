"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteWorkOrder } from "@/app/(app)/work-orders/actions";

export function DeleteWorkOrderButton({
  workOrderId,
  equipmentLabel,
  status,
  hasInventoryLines,
  redirectTo,
}: {
  workOrderId: string;
  equipmentLabel: string;
  /** droppedOff/declined confirm normally; anything further along the bench is an Owner-only override the server enforces regardless of what this button shows. */
  status: string;
  hasInventoryLines: boolean;
  /** Where to send the user after a successful delete — the detail page navigates away since the work order no longer exists; the list page just refreshes in place. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const stockNote = hasInventoryLines ? " Any inventory it used will be restored to stock." : "";
    const liveWarning =
      status === "droppedOff" || status === "declined"
        ? `Permanently delete this work order for ${equipmentLabel}? This can't be undone.${stockNote}`
        : `This work order (${equipmentLabel}) is already past intake — deleting it erases all record of the work done so far.${stockNote} This is permanent. Are you absolutely sure?`;
    if (!confirm(liveWarning)) return;
    startTransition(async () => {
      const result = await deleteWorkOrder(workOrderId);
      if (result?.error) {
        alert(result.error);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <button onClick={handleDelete} disabled={pending} className="text-[11px] font-bold disabled:opacity-50" style={{ color: "var(--color-error-solid)" }}>
      {pending ? "…" : "Delete"}
    </button>
  );
}
