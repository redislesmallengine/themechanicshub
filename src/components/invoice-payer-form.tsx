"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInvoicePayer } from "@/app/(app)/invoices/actions";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export function InvoicePayerForm({
  invoiceId,
  warrantyProviders,
  initialPayerType,
  initialWarrantyProviderId,
  initialClaimNumber,
}: {
  invoiceId: string;
  warrantyProviders: { id: string; name: string }[];
  initialPayerType: string;
  initialWarrantyProviderId: string;
  initialClaimNumber: string;
}) {
  const router = useRouter();
  const [payerType, setPayerType] = useState(initialPayerType);
  const [warrantyProviderId, setWarrantyProviderId] = useState(initialWarrantyProviderId);
  const [claimNumber, setClaimNumber] = useState(initialClaimNumber);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    payerType !== initialPayerType || (payerType === "warranty" && (warrantyProviderId !== initialWarrantyProviderId || claimNumber !== initialClaimNumber));

  function handleSave() {
    setError(null);
    const formData = new FormData();
    formData.set("payerType", payerType);
    formData.set("warrantyProviderId", warrantyProviderId);
    formData.set("claimNumber", claimNumber);
    startTransition(async () => {
      const result = await setInvoicePayer(invoiceId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
          Bill This Invoice To
        </div>
        <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-strong)" }}>
          <button
            type="button"
            onClick={() => setPayerType("customer")}
            className="px-4 py-1.5 text-xs font-semibold"
            style={payerType === "customer" ? { background: "var(--color-brand-600)", color: "#fff" } : { background: "var(--bg-surface)", color: "var(--text-secondary)" }}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => setPayerType("warranty")}
            className="px-4 py-1.5 text-xs font-semibold"
            style={payerType === "warranty" ? { background: "var(--color-brand-600)", color: "#fff" } : { background: "var(--bg-surface)", color: "var(--text-secondary)" }}
          >
            Warranty Claim
          </button>
        </div>
      </div>

      {payerType === "warranty" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="warrantyProviderId" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Warranty Provider
            </label>
            {warrantyProviders.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No warranty providers set up yet — add one under Configuration → Warranty Providers.
              </p>
            ) : (
              <select
                id="warrantyProviderId"
                value={warrantyProviderId}
                onChange={(e) => setWarrantyProviderId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs font-semibold"
                style={inputStyle}
              >
                <option value="" disabled>
                  Select…
                </option>
                {warrantyProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label htmlFor="claimNumber" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Claim / Authorization # (optional)
            </label>
            <input
              id="claimNumber"
              value={claimNumber}
              onChange={(e) => setClaimNumber(e.target.value)}
              placeholder="e.g. WC-2026-04471"
              className="w-full px-3 py-2 rounded-lg text-xs font-medium"
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}

      {dirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || (payerType === "warranty" && !warrantyProviderId)}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      )}
    </div>
  );
}
