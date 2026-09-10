"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRole } from "@/app/(app)/admin/roles/actions";

export function DeleteRoleButton({ roleKey, label, inUse }: { roleKey: string; label: string; inUse: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm(`Delete the "${label}" role? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteRole(roleKey);
      if (result?.error) {
        setError(result.error);
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={pending || inUse}
        title={inUse ? "Reassign staff off this role before deleting it" : "Delete role"}
        className="text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ color: "var(--color-error-solid)" }}
      >
        {pending ? "…" : "Delete"}
      </button>
      {error && <span className="sr-only">{error}</span>}
    </>
  );
}
