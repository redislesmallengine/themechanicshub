"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePart } from "@/app/(app)/inventory/actions";

export function DeletePartButton({ partId, name, redirectTo }: { partId: string; name: string; redirectTo?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete ${name}? This removes its stock history too and can't be undone.`)) return;
    startTransition(async () => {
      const result = await deletePart(partId);
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
