"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvoice } from "@/app/(app)/invoices/actions";
import { EmailSentNotice } from "@/components/email-sent-notice";

/**
 * "Send receipt now": one button in the invoice page's header, next to Download PDF, View Invoice and WhatsApp.
 * A paid invoice goes out as a receipt (thank-you with the amount paid, PDF attached), straight away, no preview.
 */
export function SendReceiptButton({ invoiceId, recipientEmail }: { invoiceId: string; recipientEmail: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    if (!recipientEmail) {
      setError("There is no email address on file for this invoice. Add one on the customer, or use WhatsApp or the PDF.");
      return;
    }
    startTransition(async () => {
      const result = await sendInvoice(invoiceId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <div className="relative">
      <button type="button" onClick={handleClick} disabled={pending} className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60 whitespace-nowrap">
        {pending ? "Sending…" : "Send receipt now"}
      </button>
      {error && (
        <p className="absolute right-0 top-full mt-1.5 z-10 w-72 rounded-lg px-3 py-2 text-[11px] font-semibold" role="alert" style={{ color: "var(--color-error-solid)", background: "var(--color-error-subtle)", border: "1px solid var(--color-error-solid)" }}>
          {error}
        </p>
      )}
      {sent && (
        <EmailSentNotice
          title="Receipt sent"
          to={recipientEmail}
          onClose={() => {
            setSent(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
