"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvoice, markInvoicePaid, voidInvoice } from "@/app/(app)/invoices/actions";
import { PAYMENT_METHODS } from "@/lib/invoices";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

type ActionResult = { success?: boolean; error?: string } | undefined;

function SendForm({ invoiceId, hasCustomerEmail }: { invoiceId: string; hasCustomerEmail: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await sendInvoice(invoiceId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      {!hasCustomerEmail && (
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-warning-solid)" }}>
          This customer has no email on file — add one before you can send this invoice.
        </p>
      )}
      <button onClick={handleClick} disabled={pending || !hasCustomerEmail} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Sending…" : "Send Invoice"}
      </button>
      {error && (
        <p className="text-xs font-semibold mt-2" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function MarkPaidForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = markInvoicePaid.bind(null, invoiceId);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <label htmlFor="paymentMethod" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Payment Method
          </label>
          <select id="paymentMethod" name="paymentMethod" required defaultValue="" className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
            <option value="" disabled>
              Select…
            </option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="paymentReference" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Reference (optional)
          </label>
          <input id="paymentReference" name="paymentReference" type="text" placeholder="e-transfer confirmation #, etc." className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
      </div>
      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Saving…" : "Mark as Paid"}
      </button>
    </form>
  );
}

function VoidForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = voidInvoice.bind(null, invoiceId);

  function handleSubmit(formData: FormData) {
    if (!confirm("Void this invoice? This can't be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="flex items-end gap-2 flex-wrap pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <div className="flex-1 min-w-[220px]">
        <label htmlFor="voidReason" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Void Reason
        </label>
        <input id="voidReason" name="voidReason" type="text" required placeholder="Why this invoice is being voided" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
      </div>
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--color-error-solid)" }}>
        {pending ? "Voiding…" : "Void Invoice"}
      </button>
      {error && (
        <p className="text-xs font-semibold w-full" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </form>
  );
}

export function InvoiceStatusPanel({
  invoiceId,
  status,
  hasCustomerEmail,
  canVoid,
}: {
  invoiceId: string;
  status: string;
  hasCustomerEmail: boolean;
  canVoid: boolean;
}) {
  return (
    <div className="space-y-3">
      {status === "draft" && <SendForm invoiceId={invoiceId} hasCustomerEmail={hasCustomerEmail} />}
      {(status === "sent" || status === "viewed") && (
        <>
          <MarkPaidForm invoiceId={invoiceId} />
          {canVoid && <VoidForm invoiceId={invoiceId} />}
        </>
      )}
      {status === "paid" && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-success-solid)" }}>
          Paid.
        </p>
      )}
      {status === "void" && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          Voided.
        </p>
      )}
    </div>
  );
}
