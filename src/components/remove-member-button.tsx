"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function RemoveMemberButton({ memberId, name }: { memberId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleRemove() {
    if (!confirm(`Remove ${name} from the shop? They'll lose access immediately.`)) return;
    setBusy(true);
    const { error } = await authClient.organization.removeMember({ memberIdOrEmail: memberId });
    setBusy(false);
    if (error) {
      alert(error.message ?? "Couldn't remove that staff member.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleRemove}
      disabled={busy}
      title="Remove from shop"
      className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50"
      style={{ color: "var(--text-secondary)" }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </svg>
    </button>
  );
}
