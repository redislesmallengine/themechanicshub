"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishJob } from "@/app/(app)/invoices/actions";
import { markReadyForPickup } from "@/app/(app)/work-orders/actions";
import { offerUndo } from "@/lib/job-undo";
import { PAYMENT_METHODS } from "@/lib/invoices";
import { buildInvoiceFromBilling, type ExtraCharge } from "@/lib/invoice-lines";
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

type Outcome = "paidTook" | "paidLater" | "billLater" | "claimTook" | "claimShelf";
const OUTCOMES: { value: Outcome; title: string; text: string }[] = [
  { value: "paidTook", title: "Customer paid and took it", text: "Paid at the counter, machine goes home." },
  { value: "paidLater", title: "Customer paid, will pick it up later", text: "Paid now, machine waits on the shelf." },
  { value: "billLater", title: "Bill the customer later", text: "Make the invoice and send it when you are ready." },
];
const CLAIM_OUTCOMES: { value: Outcome; title: string; text: string }[] = [
  { value: "claimTook", title: "Customer took it", text: "Machine goes home; the claim is sent to the provider." },
  { value: "claimShelf", title: "Customer will pick it up later", text: "Machine waits on the shelf; the claim is sent to the provider." },
];

const linkButton = "text-xs font-bold text-brand-600 disabled:opacity-60 text-left";

/**
 * Finishing a job, in two small steps on one card. First what was done and a single "Repair finished" button; then the
 * price and how the customer settled up, with one button that says Finish. The price can be a flat amount or built from
 * hours and parts, and one-off charges can be added. A saved service can fill in the price and the notes.
 */
export function FinishJobPanel({
  workOrderId,
  status,
  initialRepairNotes,
  notesPrefilledFromDiagnosis,
  initialLabourHours,
  parts,
  labourRate,
  services,
  diagnosticFee,
  showDeliveryFee,
  deliveryFeeDefault,
  customerEmail,
  warrantyProviders,
  taxRate,
  taxLabel,
}: {
  workOrderId: string;
  status: "inRepair" | "readyForPickup";
  initialRepairNotes: string;
  notesPrefilledFromDiagnosis: boolean;
  initialLabourHours: string;
  parts: { name: string; quantity: number; unitSellPrice: string | null }[];
  /** The shop's hourly rate; with none set, labour hours add nothing to the bill. */
  labourRate: number | null;
  services: ServiceOption[];
  diagnosticFee: number | null;
  showDeliveryFee: boolean;
  deliveryFeeDefault: string;
  customerEmail: string | null;
  warrantyProviders: { id: string; name: string }[];
  taxRate: number;
  taxLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [emailProblem, setEmailProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [repairNotes, setRepairNotes] = useState(initialRepairNotes);
  // A job that is already Ready goes straight to the price; one still being repaired asks for "Repair finished" first.
  const [open, setOpen] = useState(status === "readyForPickup");
  const [billingMode, setBillingMode] = useState<"flat" | "hours">("flat");
  const [flatAmount, setFlatAmount] = useState("");
  const [flatTax, setFlatTax] = useState<"included" | "extra">("included");
  const [flatTaxable, setFlatTaxable] = useState(true);
  const [flatDescription, setFlatDescription] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [includeDelivery, setIncludeDelivery] = useState(showDeliveryFee);
  const [deliveryAmount, setDeliveryAmount] = useState(deliveryFeeDefault);
  const [includeDiagnostic, setIncludeDiagnostic] = useState(false);
  const [labourHours, setLabourHours] = useState(initialLabourHours);
  const [extras, setExtras] = useState<{ description: string; amount: string }[]>([]);
  const [outcome, setOutcome] = useState<Outcome>("paidTook");
  const [payer, setPayer] = useState<"customer" | "warranty">("customer");
  const [providerId, setProviderId] = useState("");
  const [claimNumber, setClaimNumber] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [emailReceipt, setEmailReceipt] = useState(false);

  const paidNow = outcome === "paidTook" || outcome === "paidLater";
  const tookIt = outcome === "paidTook" || outcome === "claimTook";
  const extraItems: ExtraCharge[] = extras
    .filter((e) => e.description.trim() && Number.isFinite(Number(e.amount)) && Number(e.amount) > 0)
    .map((e) => ({ description: e.description.trim(), amount: Number(e.amount) }));

  // The bill, worked out with the same function the server bills with, so the total shown is the total charged.
  const bill = (() => {
    const shopProfile = { labourRate: labourRate === null ? null : String(labourRate), diagnosticFee: diagnosticFee === null ? null : String(diagnosticFee), taxRate: String(taxRate) };
    const fee = Number(deliveryAmount);
    const fees = { includeDiagnosticFee: includeDiagnostic, deliveryFee: includeDelivery && deliveryAmount.trim() && Number.isFinite(fee) && fee >= 0 ? fee : null };
    if (billingMode === "flat") {
      const amount = Number(flatAmount);
      if (!(amount > 0)) return null;
      return buildInvoiceFromBilling({ billing: { mode: "flat", amount, taxIncluded: flatTax === "included", taxable: flatTaxable, description: flatDescription.trim() || "Repair service" }, labourHours: null, parts: [], shopProfile, fees, extras: extraItems });
    }
    const built = buildInvoiceFromBilling({
      billing: { mode: "hours" },
      labourHours: labourHours.trim() ? labourHours : null,
      parts: parts.map((p) => ({ name: p.name, quantity: p.quantity, unitSellPrice: p.unitSellPrice, unitCostPrice: null })),
      shopProfile,
      fees,
      extras: extraItems,
    });
    return built.lines.length > 0 ? built : null;
  })();
  const total = bill ? `$${bill.totals.total}` : null;

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
    setError(null);
    setEmailProblem(null);
    if (paidNow && !method) {
      setError("Pick how the customer paid.");
      return;
    }
    if (payer === "warranty" && !providerId) {
      setError("Choose which warranty provider this claim goes to.");
      return;
    }
    const formData = new FormData(e.currentTarget);
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
          Done. The job is billed.
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

  const providerName = warrantyProviders.find((w) => w.id === providerId)?.name;
  const summary = payer === "warranty"
    ? `We'll make a warranty claim for ${total ?? "this job"}${providerName ? ` to send to ${providerName}` : ""}, and ${outcome === "claimTook" ? "move the job to Done" : "leave the job Ready until the customer collects it"}.`
    : !paidNow
    ? `We'll make an invoice for ${total ?? "this job"} to send later, and leave the job Ready.`
    : outcome === "paidTook"
      ? `We'll record ${total ?? "the amount"} as paid${method ? ` by ${method.toLowerCase()}` : ""} and move the job to Done.`
      : `We'll record ${total ?? "the amount"} as paid${method ? ` by ${method.toLowerCase()}` : ""} and leave the job Ready until they collect it.`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="fj-repairNotes" className="block text-xs font-bold mb-1" style={labelStyle}>
          What was done
        </label>
        <textarea
          id="fj-repairNotes"
          name="repairNotes"
          rows={3}
          value={repairNotes}
          onChange={(e) => setRepairNotes(e.target.value)}
          placeholder="Parts replaced, adjustments, test results. This goes on the invoice."
          className="w-full px-3 py-2 rounded-lg text-xs font-medium"
          style={inputStyle}
        />
        {notesPrefilledFromDiagnosis && repairNotes === initialRepairNotes && (
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Started from the diagnosis. Change it to say what was actually done.
          </p>
        )}
      </div>

      {!open ? (
        <div className="space-y-2">
          {error && (
            <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }} role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
            <button type="button" onClick={() => setOpen(true)} className="px-5 py-3 rounded-lg text-sm font-extrabold bg-brand-600 hover:bg-brand-700 text-white">
              Repair finished
            </button>
            <button type="button" onClick={justMarkReady} disabled={pending} className={linkButton}>
              {pending ? "Working…" : "Mark it ready for pickup, price it later"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ---- price */}
          <div className="rounded-lg p-3 space-y-3" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
            <div className="text-[11px] font-extrabold uppercase tracking-wide" style={labelStyle}>
              Price
            </div>
            <input type="hidden" name="billingMode" value={billingMode} />
            {billingMode === "flat" ? (
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2 text-xs">
                <div>
                  <label htmlFor="fj-flatAmount" className="block font-bold mb-1" style={labelStyle}>
                    Amount charged ($)
                  </label>
                  <input id="fj-flatAmount" name="flatAmount" type="number" step="0.01" min="0" inputMode="decimal" value={flatAmount} onChange={(e) => setFlatAmount(e.target.value)} placeholder="207.00" className="w-40 px-3 py-2 rounded-lg text-sm font-mono" style={inputStyle} />
                </div>
                {taxRate > 0 && flatTaxable && (
                  <div>
                    <div className="font-bold mb-1" style={labelStyle}>
                      Does that include {taxLabel}?
                    </div>
                    <Segmented
                      value={flatTax}
                      onChange={setFlatTax}
                      label={`Does the amount include ${taxLabel}?`}
                      options={[
                        { value: "included", label: "Included" },
                        { value: "extra", label: `Add ${taxLabel}` },
                      ]}
                    />
                  </div>
                )}
                <input type="hidden" name="flatTax" value={flatTax} />
                <input type="hidden" name="flatTaxable" value={flatTaxable ? "on" : "off"} />
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                  <div>
                    <label htmlFor="fj-labourHours" className="block font-bold mb-1" style={labelStyle}>
                      Labour hours
                    </label>
                    <input id="fj-labourHours" name="labourHours" type="number" step="0.25" min="0" value={labourHours} onChange={(e) => setLabourHours(e.target.value)} className="w-28 px-3 py-2 rounded-lg text-sm font-mono" style={inputStyle} />
                  </div>
                  <div className="text-[11px] pb-2" style={labelStyle}>
                    <span className="font-bold">Parts on this job: </span>
                    {parts.length === 0 ? <span style={{ color: "var(--text-muted)" }}>none. Add any in Parts Needed first.</span> : parts.map((p) => `${p.name} × ${p.quantity}`).join(", ")}
                  </div>
                </div>
                {Number(labourHours) > 0 && labourRate === null && (
                  <p className="text-[11px] font-semibold" style={{ color: "var(--color-warning-solid)" }}>
                    No hourly rate is set in Shop Profile, so labour hours add nothing to this bill.
                  </p>
                )}
              </div>
            )}

            {extras.map((x, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2 text-xs">
                <label className="flex-1 min-w-[10rem] font-bold" style={labelStyle}>
                  Extra charge
                  <input
                    value={x.description}
                    onChange={(e) => setExtras((cur) => cur.map((r, ri) => (ri === i ? { ...r, description: e.target.value } : r)))}
                    placeholder="e.g. New oil"
                    className="mt-1 w-full px-3 py-2 rounded-lg text-xs font-medium"
                    style={inputStyle}
                  />
                </label>
                <label className="w-28 font-bold" style={labelStyle}>
                  Price before tax ($)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={x.amount}
                    onChange={(e) => setExtras((cur) => cur.map((r, ri) => (ri === i ? { ...r, amount: e.target.value } : r)))}
                    className="mt-1 w-full px-3 py-2 rounded-lg text-xs font-mono"
                    style={inputStyle}
                  />
                </label>
                <button type="button" onClick={() => setExtras((cur) => cur.filter((_, ri) => ri !== i))} className="px-2 py-2 text-xs font-bold" style={{ color: "var(--color-error-solid)" }} aria-label="Remove this extra charge">
                  Remove
                </button>
              </div>
            ))}
            <input type="hidden" name="extraCharges" value={JSON.stringify(extras)} />

            {bill && (
              <div className="text-[11px] font-semibold tabular-nums space-y-0.5" style={labelStyle}>
                {billingMode === "hours" &&
                  bill.lines.map((l) => (
                    <div key={l.sortOrder} className="flex justify-between gap-3 max-w-md">
                      <span>{l.description}</span>
                      <span>${l.lineTotal}</span>
                    </div>
                  ))}
                <p>
                  ${bill.totals.subtotal}
                  {taxRate > 0 ? ` + ${taxLabel} $${bill.totals.taxAmount}` : ""} = <span style={{ color: "var(--text-primary)" }}>${bill.totals.total}</span>
                  {billingMode === "flat" && flatTax === "included" && taxRate > 0 && flatTaxable && extraItems.length === 0 ? " (the amount you typed, with the tax in it)" : ""}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <button type="button" onClick={() => setExtras((cur) => [...cur, { description: "", amount: "" }])} className={linkButton}>
                + Add another charge
              </button>
              <button type="button" onClick={() => setBillingMode(billingMode === "flat" ? "hours" : "flat")} className={linkButton}>
                {billingMode === "flat" ? "Charge by hours and parts instead" : "Charge one flat price instead"}
              </button>
            </div>

            <details>
              <summary className="text-xs font-bold cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                More price options
              </summary>
              <div className="mt-3 space-y-3 text-xs">
                {services.length > 0 && (
                  <div className="max-w-md">
                    <label htmlFor="fj-service" className="block font-bold mb-1" style={labelStyle}>
                      Start from a saved service
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
                {billingMode === "flat" && (
                  <div className="max-w-md">
                    <label htmlFor="fj-flatDescription" className="block font-bold mb-1" style={labelStyle}>
                      Name on the invoice
                    </label>
                    <input id="fj-flatDescription" name="flatDescription" type="text" value={flatDescription} onChange={(e) => setFlatDescription(e.target.value)} placeholder="Repair service" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
                  </div>
                )}
                {(diagnosticFee || showDeliveryFee) && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    {diagnosticFee ? (
                      <label className="flex items-center gap-1.5 font-semibold" style={labelStyle}>
                        <input type="checkbox" name="includeDiagnosticFee" checked={includeDiagnostic} onChange={(e) => setIncludeDiagnostic(e.target.checked)} className="rounded" style={{ accentColor: "#0F52BA" }} />
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
                            <input aria-label="Delivery fee amount" name="deliveryFeeAmount" type="number" step="0.01" min="0" required value={deliveryAmount} onChange={(e) => setDeliveryAmount(e.target.value)} placeholder="0.00" className="w-24 px-2 py-1 rounded-lg text-xs font-mono" style={inputStyle} />
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </details>
          </div>

          {/* ---- how the customer settled up */}
          <div className="rounded-lg p-3 space-y-3" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
            <div className="text-[11px] font-extrabold uppercase tracking-wide" style={labelStyle}>
              What happened with the customer?
            </div>
            <input type="hidden" name="payment" value={paidNow ? "now" : "later"} />
            {tookIt && <input type="hidden" name="pickedUp" value="on" />}
            {warrantyProviders.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-bold" style={labelStyle}>
                  Who pays?
                </span>
                <Segmented
                  value={payer}
                  onChange={(v) => {
                    setPayer(v);
                    setOutcome(v === "warranty" ? "claimTook" : "paidTook");
                  }}
                  label="Who pays for this job?"
                  options={[
                    { value: "customer", label: "The customer" },
                    { value: "warranty", label: "A warranty provider" },
                  ]}
                />
              </div>
            )}
            {payer === "warranty" && (
              <>
                <input type="hidden" name="payerType" value="warranty" />
                <div className="grid gap-2 sm:grid-cols-2 text-xs">
                  <label className="font-bold" style={labelStyle}>
                    Warranty provider
                    <select name="warrantyProviderId" value={providerId} onChange={(e) => setProviderId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
                      <option value="">Choose…</option>
                      {warrantyProviders.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="font-bold" style={labelStyle}>
                    Claim number (optional)
                    <input name="claimNumber" value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
                  </label>
                </div>
              </>
            )}
            <div role="radiogroup" aria-label="What happened with the customer" className={`grid gap-2 ${payer === "warranty" ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
              {(payer === "warranty" ? CLAIM_OUTCOMES : OUTCOMES).map((o) => {
                const on = outcome === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setOutcome(o.value)}
                    className="text-left rounded-lg px-3 py-2"
                    style={on ? { background: "var(--color-info-subtle)", border: "2px solid var(--color-brand-600)" } : { background: "var(--bg-surface)", border: "1px solid var(--border-strong)" }}
                  >
                    <div className="text-xs font-extrabold" style={{ color: on ? "var(--color-brand-600)" : "var(--text-primary)" }}>
                      {o.title}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {o.text}
                    </div>
                  </button>
                );
              })}
            </div>

            {paidNow && (
              <div className="space-y-2 text-xs">
                <div className="font-bold" style={labelStyle}>
                  How did they pay?
                </div>
                <input type="hidden" name="paymentMethod" value={method} />
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How did they pay?">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={method === m}
                      onClick={() => setMethod(m)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold"
                      style={method === m ? { background: "var(--color-brand-600)", color: "#fff", border: "1px solid var(--color-brand-600)" } : { background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-strong)" }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {(method === "E-transfer" || method === "Cheque") && (
                  <label className="block max-w-xs font-bold" style={labelStyle}>
                    {method === "Cheque" ? "Cheque number (optional)" : "E-transfer confirmation (optional)"}
                    <input name="paymentReference" type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
                  </label>
                )}
                {customerEmail && (
                  <label className="flex items-center gap-1.5 font-semibold" style={labelStyle}>
                    <input type="checkbox" name="emailReceipt" checked={emailReceipt} onChange={(e) => setEmailReceipt(e.target.checked)} style={{ accentColor: "#0F52BA" }} />
                    Email a receipt to {customerEmail}
                  </label>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }} role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
            <button type="submit" disabled={pending} className="px-6 py-3 rounded-lg text-sm font-extrabold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
              {pending ? "Saving…" : total ? `Finish · ${total}` : "Finish"}
            </button>
            {status === "inRepair" && (
              <button type="button" onClick={justMarkReady} disabled={pending} className={linkButton}>
                Mark it ready for pickup, price it later
              </button>
            )}
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {summary}
          </p>
        </>
      )}
    </form>
  );
}
