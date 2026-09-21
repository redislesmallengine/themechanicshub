"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInvoice } from "@/app/(app)/invoices/actions";

export function DeleteInvoiceButton({
  invoiceId,
  invoiceNumber,
  status,
  hasInventoryLines,
  redirectTo,
}: {
  invoiceId: string;
  invoiceNumber: string;
  /** Draft/void confirm normally; sent/viewed/paid get an extra-strong warning — deleting one of those is an Owner-only override the server enforces regardless of what this button shows. */
  status: string;
  hasInventoryLines: boolean;
  /** Where to send the user after a successful delete — the detail page navigates away since the invoice no longer exists; the list page just refreshes in place. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const stockNote = hasInventoryLines ? " Any inventory it used will be restored to stock." : "";
    const liveWarning =
      status === "paid"
        ? `${invoiceNumber} has already been PAID — deleting it erases all record that this customer ever paid you.${stockNote} This is permanent. Are you absolutely sure?`
        : status === "sent" || status === "viewed"
          ? `${invoiceNumber} has already been sent to the customer — their link will stop working and any record of it will be gone.${stockNote} This is permanent. Are you absolutely sure?`
          : `Permanently delete ${invoiceNumber}? This can't be undone.${stockNote}`;
    if (!confirm(liveWarning)) return;
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
