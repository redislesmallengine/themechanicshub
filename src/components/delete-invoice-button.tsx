"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInvoice } from "@/app/(app)/invoices/actions";

export function DeleteInvoiceButton({
  invoiceId,
  invoiceNumber,
  hasInventoryLines,
  redirectTo,
}: {
  invoiceId: string;
  invoiceNumber: string;
  hasInventoryLines: boolean;
  /** Where to send the user after a successful delete — the detail page navigates away since the invoice no longer exists; the list page just refreshes in place. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const stockNote = hasInventoryLines ? " Any inventory it used will be restored to stock." : "";
    if (!confirm(`Permanently delete ${invoiceNumber}? This can't be undone.${stockNote}`)) return;
    startTransition(async () => {
      const result = await deleteInvoice(invoiceId);
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
