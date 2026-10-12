"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveShop, rejectShop } from "@/app/(app)/admin/shops/actions";

/** Approve / Reject for one shop on the Shop Approvals page. Rejecting asks for an optional reason first. */
export function ShopApprovalButtons({ organizationId, shopName, status }: { organizationId: string; shopName: string; status: "pending" | "rejected" | "approved" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ success?: boolean; error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setAsking(false);
      router.refresh();
    });
  }

  if (status === "approved") {
    return (
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        —
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveShop(organizationId))}
          className="px-3 py-1 rounded-lg text-[11px] font-bold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
        >
          {pending ? "Working…" : "Approve"}
        </button>
        {status === "pending" && !asking && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setAsking(true)}
            className="px-3 py-1 rounded-lg text-[11px] font-bold disabled:opacity-60"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--color-error-solid)" }}
          >
            Reject
          </button>
        )}
      </div>
      {asking && (
        <div className="flex flex-col items-end gap-1.5 w-64">
          <label htmlFor={`reject-${organizationId}`} className="sr-only">
            Reason for rejecting {shopName} (optional)
          </label>
          <textarea
            id={`reject-${organizationId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Reason, shown to the owner (optional)"
            className="w-full px-2 py-1.5 rounded-lg text-[11px]"
            style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setAsking(false)} className="px-3 py-1 rounded-lg text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => rejectShop(organizationId, note))}
              className="px-3 py-1 rounded-lg text-[11px] font-bold text-white disabled:opacity-60"
              style={{ background: "var(--color-error-solid)" }}
            >
              Confirm reject
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="text-[11px] font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
