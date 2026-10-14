"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishJob } from "@/app/(app)/invoices/actions";
import { markReadyForPickup } from "@/app/(app)/work-orders/actions";
import { offerUndo } from "@/lib/job-undo";
import { PAYMENT_METHODS } from "@/lib/invoices";
import { flatPriceTotals } from "@/lib/pricing";
import { SearchSelect } from "@/components/search-select";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};
const labelStyle = { color: "var(--text-secondary)" };

export interface ServiceOption {
  id: string;
  name: string;
  price: number;
  taxable: boolean;
  description: string | null;
}

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-strong)" }} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className="px-3 py-1.5 text-[11px] font-bold"
          style={value === o.value ? { background: "var(--color-brand-600)", color: "#fff" } : { background: "var(--bg-surface)", color: "var(--text-secondary)" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Finish & collect: the one panel for taking a job from In Repair (or Ready for pickup) to billed, and
 * optionally paid and picked up. What was done, the price, how it is being paid -- on one screen, with a
 * button that says exactly what it will do. A saved service can fill in the price and the notes.
 */
export function FinishJobPanel({
  workOrderId,
  status,
  initialRepairNotes,
  notesPrefilledFromDiagnosis,
  initialLabourHours,
  parts,
  services,
  diagnosticFee,
  showDeliveryFee,
  deliveryFeeDefault,
  customerEmail,
  taxRate,
  taxLabel,
}: {
  workOrderId: string;
  status: "inRepair" | "readyForPickup";
  initialRepairNotes: string;
  notesPrefilledFromDiagnosis: boolean;
  initialLabourHours: string;
  parts: { name: string; quantity: number }[];
  services: ServiceOption[];
  diagnosticFee: number | null;
  showDeliveryFee: boolean;
  deliveryFeeDefault: string;
  customerEmail: string | null;
  taxRate: number;
  taxLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [emailProblem, setEmailProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [repairNotes, setRepairNotes] = useState(initialRepairNotes);
  const [billingMode, setBillingMode] = useState<"flat" | "hours">("flat");
  const [flatAmount, setFlatAmount] = useState("");
  const [flatTax, setFlatTax] = useState<"included" | "extra">("included");
  const [flatTaxable, setFlatTaxable] = useState(true);
  const [flatDescription, setFlatDescription] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [includeDelivery, setIncludeDelivery] = useState(showDeliveryFee);
  const [payment, setPayment] = useState<"now" | "later">("now");
  const [pickedUp, setPickedUp] = useState(true);

  const flat = (() => {
    const amount = Number(flatAmount);
    return Number.isFinite(amount) && amount > 0 ? flatPriceTotals(amount, flatTax === "included", taxRate, flatTaxable) : null;
  })();

  function pickService(id: string) {
    setServiceId(id);
    const service = services.find((s) => s.id === id);
    if (!service) return;
    // A saved price is the price before tax; the owner can still change any of it.
    setBillingMode("flat");
    setFlatAmount(service.price.toFixed(2));
    setFlatTax("extra");
    setFlatTaxable(service.taxable);
    setFlatDescription(service.name);
    if (!repairNotes.trim() && service.description) setRepairNotes(service.description);
  }

  // onSubmit, not <form action>: React 19 resets the fields after an action finishes, and a failed attempt
  // (say a missing payment method) must not wipe what was typed.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setEmailProblem(null);
    startTransition(async () => {
      const result = await finishJob(workOrderId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.success && result.emailError) {
        setEmailProblem(result.emailError);
        return;
      }
      router.refresh();
    });
  }

  function justMarkReady() {
    setError(null);
    startTransition(async () => {
      const result = await markReadyForPickup(workOrderId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      offerUndo(workOrderId, "Marked ready", result.previous);
      router.refresh();
    });
  }

  if (emailProblem) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-success-solid)" }}>
          Done — the job is billed.
        </p>
        <p className="text-xs font-semibold" style={{ color: "var(--color-warning-solid)" }}>
          The receipt email wasn&apos;t sent: {emailProblem}
        </p>
        <button type="button" onClick={() => router.refresh()} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white">
          Continue
        </button>
      </div>
    );
  }

  const buttonLabel = pending
    ? "Saving…"
    : payment === "now"
      ? flat
        ? `Finish & collect $${flat.total}`
        : "Finish & collect"
      : "Finish & create invoice";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="fj-repairNotes" className="block text-xs font-bold mb-1" style={labelStyle}>
          Work performed
        </label>
        <textarea
          id="fj-repairNotes"
          name="repairNotes"
          rows={3}
          value={repairNotes}
          onChange={(e) => setRepairNotes(e.target.value)}
          placeholder="What was done — parts replaced, adjustments, test results. This goes on the invoice."
          className="w-full px-3 py-2 rounded-lg text-xs font-medium"
          style={inputStyle}
        />
        {notesPrefilledFromDiagnosis && repairNotes === initialRepairNotes && (
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Pre-filled from the diagnosis — edit it to say what was actually done.
          </p>
        )}
      </div>

      {/* ---- price */}
      <div className="rounded-lg p-3 space-y-3" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
        <div className="text-[11px] font-extrabold uppercase tracking-wide" style={labelStyle}>
          Price
        </div>
        {services.length > 0 && (
          <div className="max-w-md">
            <label htmlFor="fj-service" className="block text-xs font-bold mb-1" style={labelStyle}>
              Use a saved service (optional)
            </label>
            <SearchSelect
              id="fj-service"
              value={serviceId}
              onChange={pickService}
              placeholder="Type to find a service, e.g. Snowblower…"
              options={services.map((s) => ({ value: s.id, label: s.name, hint: `$${s.price.toFixed(2)}`, keywords: s.description ?? "" }))}
            />
          </div>
        )}
        <input type="hidden" name="billingMode" value={billingMode} />
        <Segmented
          value={billingMode}
          onChange={setBillingMode}
          label="How to bill this job"
          options={[
            { value: "flat", label: "One flat price" },
            { value: "hours", label: "By hours & parts" },
          ]}
        />
        {billingMode === "flat" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label htmlFor="fj-flatAmount" className="block font-bold mb-1" style={labelStyle}>
                Amount charged ($)
              </label>
              <input id="fj-flatAmount" name="flatAmount" type="number" step="0.01" min="0" inputMode="decimal" value={flatAmount} onChange={(e) => setFlatAmount(e.target.value)} placeholder="207.00" className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
            </div>
            <div>
              <div className="font-bold mb-1" style={labelStyle}>
                Tax
              </div>
              <Segmented
                value={flatTax}
                onChange={setFlatTax}
                label="Does the amount include tax?"
                options={[
                  { value: "included", label: "Included" },
                  { value: "extra", label: "Add tax" },
                ]}
              />
              <input type="hidden" name="flatTax" value={flatTax} />
              <input type="hidden" name="flatTaxable" value={flatTaxable ? "on" : "off"} />
            </div>
            <div>
              <label htmlFor="fj-flatDescription" className="block font-bold mb-1" style={labelStyle}>
                Shown on the invoice as
              </label>
              <input id="fj-flatDescription" name="flatDescription" type="text" value={flatDescription} onChange={(e) => setFlatDescription(e.target.value)} placeholder="Repair service" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
            </div>
            {flat && (
              <p className="sm:col-span-3 text-[11px] font-semibold tabular-nums" style={labelStyle}>
                ${flat.subtotal}
                {taxRate > 0 && flatTaxable ? ` + ${taxLabel} $${flat.taxAmount}` : ""} = <span style={{ color: "var(--text-primary)" }}>${flat.total}</span>
                {flatTax === "included" && taxRate > 0 && flatTaxable ? " (tax included in the amount you typed)" : ""}
                {!flatTaxable ? " (no tax on this service)" : ""}
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label htmlFor="fj-labourHours" className="block font-bold mb-1" style={labelStyle}>
                Labour hours
              </label>
              <input id="fj-labourHours" name="labourHours" type="number" step="0.25" min="0" defaultValue={initialLabourHours} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
            </div>
            <div className="sm:col-span-2 self-end text-[11px]" style={labelStyle}>
              <span className="font-bold">Parts on this job: </span>
              {parts.length === 0 ? <span style={{ color: "var(--text-muted)" }}>none — add any in Parts Needed below first.</span> : parts.map((p) => `${p.name} × ${p.quantity}`).join(", ")}
            </div>
          </div>
        )}
        {(diagnosticFee || showDeliveryFee) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
            {diagnosticFee ? (
              <label className="flex items-center gap-1.5 font-semibold" style={labelStyle}>
                <input type="checkbox" name="includeDiagnosticFee" className="rounded" style={{ accentColor: "#0F52BA" }} />
                Add the diagnostic fee (${diagnosticFee.toFixed(2)})
              </label>
            ) : null}
            {showDeliveryFee && (
              <>
                <label className="flex items-center gap-1.5 font-semibold" style={labelStyle}>
                  <input type="checkbox" name="includeDeliveryFee" checked={includeDelivery} onChange={(e) => setIncludeDelivery(e.target.checked)} className="rounded" style={{ accentColor: "#0F52BA" }} />
                  Add pickup/delivery fee
                </label>
                {includeDelivery && (
                  <span className="flex items-center gap-1">
                    <span style={{ color: "var(--text-muted)" }}>$</span>
                    <input aria-label="Delivery fee amount" name="deliveryFeeAmount" type="number" step="0.01" min="0" required defaultValue={deliveryFeeDefault} placeholder="0.00" className="w-24 px-2 py-1 rounded-lg text-xs font-mono" style={inputStyle} />
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ---- payment */}
      <div className="rounded-lg p-3 space-y-3" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
        <div className="text-[11px] font-extrabold uppercase tracking-wide" style={labelStyle}>
          Payment
        </div>
        <input type="hidden" name="payment" value={payment} />
        <Segmented
          value={payment}
          onChange={(v) => {
            setPayment(v);
            setPickedUp(v === "now"); // paying at the counter usually means taking the machine; billing for later usually doesn't
          }}
          label="Is the customer paying now?"
          options={[
            { value: "now", label: "Paid now" },
            { value: "later", label: "Bill later" },
          ]}
        />
        {payment === "now" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label htmlFor="fj-paymentMethod" className="block font-bold mb-1" style={labelStyle}>
                Payment method
              </label>
              <select id="fj-paymentMethod" name="paymentMethod" required defaultValue="" className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
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
              <label htmlFor="fj-paymentReference" className="block font-bold mb-1" style={labelStyle}>
                Reference (optional)
              </label>
              <input id="fj-paymentReference" name="paymentReference" type="text" placeholder="e-transfer #, etc." className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
            </div>
          </div>
        )}
        <label className="flex items-center gap-1.5 text-xs font-semibold" style={labelStyle}>
          <input type="checkbox" name="pickedUp" checked={pickedUp} onChange={(e) => setPickedUp(e.target.checked)} style={{ accentColor: "#0F52BA" }} />
          Customer picked up the machine (or you delivered it)
        </label>
        {payment === "now" && customerEmail && (
          <label className="flex items-center gap-1.5 text-xs font-semibold" style={labelStyle}>
            <input type="checkbox" name="emailReceipt" style={{ accentColor: "#0F52BA" }} />
            Also email a receipt to {customerEmail}
          </label>
        )}
      </div>

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }} role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4 flex-wrap">
        <button type="submit" disabled={pending} className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {buttonLabel}
        </button>
        {status === "inRepair" && (
          <button type="button" onClick={justMarkReady} disabled={pending} className="text-xs font-bold text-brand-600 disabled:opacity-60">
            Just mark it ready for pickup
          </button>
        )}
      </div>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        {payment === "now" ? "Creates the invoice already paid" : "Creates the invoice as a draft"}
        {pickedUp ? " and closes the job as picked up / delivered." : " and leaves the job Ready for pickup."}
      </p>
    </form>
  );
}
