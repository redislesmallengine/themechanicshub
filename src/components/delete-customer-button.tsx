"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomer } from "@/app/(app)/customers/actions";

export function DeleteCustomerButton({ customerId, name, equipmentCount }: { customerId: string; name: string; equipmentCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const equipmentWarning = equipmentCount > 0 ? ` and their ${equipmentCount} piece${equipmentCount === 1 ? "" : "s"} of equipment` : "";
    if (!confirm(`Delete ${name}${equipmentWarning}? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteCustomer(customerId);
      if (result?.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button onClick={handleDelete} disabled={pending} className="text-[11px] font-bold disabled:opacity-50" style={{ color: "var(--color-error-solid)" }}>
      {pending ? "…" : "Delete"}
    </button>
  );
}
