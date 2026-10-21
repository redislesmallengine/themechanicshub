"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { finishJob } from "@/app/(app)/invoices/actions";
import { markReadyForPickup, removeWorkOrderPart } from "@/app/(app)/work-orders/actions";
import { offerUndo } from "@/lib/job-undo";
import { PAYMENT_METHODS } from "@/lib/invoices";
import { buildInvoiceFromRows, type BillingRow, type BillingRowKind } from "@/lib/invoice-lines";
import { AddPartPicker, type AvailablePart } from "@/components/add-part-picker";
import { SearchSelect } from "@/components/search-select";
import { secondaryButton, dangerButton } from "@/lib/ui";

export interface ServiceOption {
  id: string;
  name: string;
  price: number;
  taxable: boolean;
  description: string | null;
}

interface PartData {
  id: string;
  name: string;
  quantity: number;
  unitSellPrice: string | null;
}

/** A row the person typed or added (labour, a saved service, another charge). Parts come from the job itself. */
interface TypedRow {
  key: string;
  kind: Exclude<BillingRowKind, "part">;
  description: string;
  quantity: string;
  unitPrice: string;
  taxable: boolean;
}

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="inline-flex rounded-xl overflow-hidden" style={{ border: "2px solid var(--text-primary)" }} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className="px-4 py-2 text-base font-extrabold"
          style={value === o.value ? { background: "var(--text-primary)", color: "var(--bg-surface)" } : { background: "var(--bg-surface)", color: "var(--text-primary)" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const money = (n: number) => `$${n.toFixed(2)}`;
const KIND_ORDER: Record<BillingRowKind, number> = { labour: 0, service: 1, part: 2, other: 3 };
const KIND_TAG: Record<BillingRowKind, string> = { labour: "Labour", service: "Service", part: "Part", other: "Other" };

let keyCounter = 0;
const nextKey = () => `row-${++keyCounter}`;

/**
 * The Billing step: every charge is a big row (labour, saved services, parts, other charges) with a quantity, a price and
 * a total, a live preview of the invoice the customer will get, and two ways to finish: just create the invoice, or create
 * it and take payment. The parts used on the job arrive as rows by themselves.
 */
export function BillingScreen({
  workOrderId,
  status,
  initialNotes,
  parts,
  availableParts,
  labourHours,
  labourRate,
  services,
  diagnosticFee,
  showDeliveryFee,
  deliveryFeeDefault,
  customerEmail,
  customerName,
  equipmentLabel,
  shopName,
  hstNumber,
  warrantyProviders,
  taxRate,
  taxLabel,
}: {
  workOrderId: string;
  status: "inRepair" | "readyForPickup";
  initialNotes: string;
  parts: PartData[];
  availableParts: AvailablePart[];
  labourHours: string;
  labourRate: number | null;
  services: ServiceOption[];
  diagnosticFee: number | null;
  showDeliveryFee: boolean;
  deliveryFeeDefault: string;
  customerEmail: string | null;
  customerName: string;
  equipmentLabel: string;
  shopName: string;
  hstNumber: string | null;
  warrantyProviders: { id: string; name: string }[];
  taxRate: number;
  taxLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [emailProblem, setEmailProblem] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const [typed, setTyped] = useState<TypedRow[]>(() => {
    const start: TypedRow[] = [];
    const hours = Number(labourHours);
    if (hours > 0) start.push({ key: nextKey(), kind: "labour", description: "Labour", quantity: String(hours), unitPrice: labourRate === null ? "" : labourRate.toFixed(2), taxable: true });
    if (showDeliveryFee && deliveryFeeDefault.trim() !== "") start.push({ key: nextKey(), kind: "other", description: "Pickup/delivery fee", quantity: "1", unitPrice: Number(deliveryFeeDefault).toFixed(2), taxable: true });
    return start;
  });
  const [partPrices, setPartPrices] = useState<Record<string, string>>({});
  const [taxMode, setTaxMode] = useState<"before" | "included">("before");
  const [notes, setNotes] = useState(initialNotes);
  const [picker, setPicker] = useState<null | "service" | "part">(null);
  const [serviceId, setServiceId] = useState("");
  const [takingPayment, setTakingPayment] = useState(false);
  const [payer, setPayer] = useState<"customer" | "warranty">("customer");
  const [providerId, setProviderId] = useState("");
  const [claimNumber, setClaimNumber] = useState("");
  const [claimTook, setClaimTook] = useState(false);
  const [outcome, setOutcome] = useState<"took" | "later">("took");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [emailReceipt, setEmailReceipt] = useState(!!customerEmail);

  // Every row on the bill, in display order: labour, services, parts, other charges.
  const displayRows = useMemo(() => {
    const all: { key: string; kind: BillingRowKind; typed?: TypedRow; part?: PartData }[] = [
      ...typed.map((t) => ({ key: t.key, kind: t.kind as BillingRowKind, typed: t })),
      ...parts.map((p) => ({ key: `part-${p.id}`, kind: "part" as BillingRowKind, part: p })),
    ];
    return all.map((r, i) => ({ r, i })).sort((a, b) => KIND_ORDER[a.r.kind] - KIND_ORDER[b.r.kind] || a.i - b.i).map((x) => x.r);
  }, [typed, parts]);

  // A typed row counts once it has a name, a quantity and a price; a half-filled one is left off the bill (and flagged on submit).
  function toBillRow(t: TypedRow): BillingRow | null {
    const quantity = Number(t.quantity);
    const unitPrice = Number(t.unitPrice);
    if (!t.description.trim() || !(quantity > 0) || t.unitPrice.trim() === "" || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
    return { kind: t.kind, description: t.description.trim(), quantity, unitPrice, taxable: t.taxable };
  }
  const billRows: BillingRow[] = displayRows.flatMap((d) => {
    if (d.part) {
      const price = Number(partPrices[d.part.id] ?? d.part.unitSellPrice ?? "0");
      return [{ kind: "part" as const, description: d.part.name, quantity: d.part.quantity, unitPrice: Number.isFinite(price) ? price : 0, taxable: true, workOrderPartId: d.part.id }];
    }
    const row = toBillRow(d.typed!);
    return row ? [row] : [];
  });
  const bill = buildInvoiceFromRows({ rows: billRows, taxIncluded: taxMode === "included", taxRate });
  const hasBill = billRows.length > 0;
  const total = hasBill ? `$${bill.totals.total}` : "$0.00";

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  function addTyped(row: Omit<TypedRow, "key">) {
    setTyped((cur) => [...cur, { key: nextKey(), ...row }]);
  }
  function updateTyped(key: string, patch: Partial<TypedRow>) {
    setTyped((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeTyped(key: string) {
    setTyped((cur) => cur.filter((r) => r.key !== key));
  }
  function addLabour() {
    addTyped({ kind: "labour", description: "Labour", quantity: "1", unitPrice: labourRate === null ? "" : labourRate.toFixed(2), taxable: true });
  }
  function pickService(id: string) {
    const service = services.find((s) => s.id === id);
    setServiceId("");
    setPicker(null);
    if (!service) return;
    addTyped({ kind: "service", description: service.name, quantity: "1", unitPrice: service.price.toFixed(2), taxable: service.taxable });
    if (service.description && !notes.includes(service.description)) setNotes((cur) => (cur.trim() ? `${cur.trim()}\n${service.description}` : service.description!));
  }
  function removePart(p: PartData) {
    if (!confirm(`Take ${p.name} off this job? The stock it used will be put back.`)) return;
    startTransition(async () => {
      const result = await removeWorkOrderPart(p.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function validate(paying: boolean): string | null {
    if (!hasBill) return "Add at least one row to the bill: labour, a service, a part or another charge. Each row needs a name, a quantity and a price.";
    const half = typed.find((t) => (t.description.trim() || t.unitPrice.trim()) && !toBillRow(t));
    if (half) return `Finish the row "${half.description.trim() || "(no name)"}": it needs a name, a quantity and a price, or remove it.`;
    if (payer === "warranty" && !providerId) return "Choose which warranty provider this claim goes to.";
    if (paying && !method) return "Pick how the customer paid: Cash, E-transfer, Card, Cheque or Other.";
    return null;
  }

  // onSubmit-style handling (not <form action>): a failed attempt must not wipe what was typed.
  function submit(paying: boolean) {
    setError(null);
    setEmailProblem(null);
    const problem = validate(paying);
    if (problem) {
      setError(problem);
      return;
    }
    const fd = new FormData();
    fd.set("billingRows", JSON.stringify(billRows));
    fd.set("taxMode", taxMode);
    fd.set("invoiceNotes", notes);
    fd.set("payment", paying ? "now" : "later");
    if (paying) {
      fd.set("paymentMethod", method);
      if (reference.trim()) fd.set("paymentReference", reference.trim());
      if (emailReceipt && customerEmail) fd.set("emailReceipt", "on");
      if (outcome === "took") fd.set("pickedUp", "on");
    }
    if (payer === "warranty") {
      fd.set("payerType", "warranty");
      fd.set("warrantyProviderId", providerId);
      if (claimNumber.trim()) fd.set("claimNumber", claimNumber.trim());
      if (claimTook) fd.set("pickedUp", "on");
    }
    startTransition(async () => {
      const result = await finishJob(workOrderId, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.success && result.emailError) {
        setInvoiceId(result.invoiceId);
        setEmailProblem(result.emailError);
        return;
      }
      // Straight to the invoice, where sending, payment and the pickup are one click each. receipt=1 makes it say the receipt went out.
      if (result?.success) router.push(`/invoices/${result.invoiceId}?created=1${result.receiptSentTo ? "&receipt=1" : ""}`);
      else router.refresh();
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
      <div className="space-y-3">
        <p className="text-lg font-extrabold" style={{ color: "var(--color-success-solid)" }}>
          Done. The job is billed.
        </p>
        <p className="text-base font-bold" style={{ color: "var(--color-warning-solid)" }}>
          The receipt email wasn&apos;t sent: {emailProblem}
        </p>
        <button type="button" onClick={() => (invoiceId ? router.push(`/invoices/${invoiceId}?created=1`) : router.refresh())} className="px-6 py-3 rounded-xl text-lg font-extrabold bg-brand-600 hover:bg-brand-700 text-white">
          Continue
        </button>
      </div>
    );
  }

  const providerName = warrantyProviders.find((w) => w.id === providerId)?.name;
  const showFlatPriceTip = displayRows.length === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
        {/* ---- the rows */}
        <div className="space-y-4">
          <h3 className="text-xl font-extrabold">What are you charging for?</h3>

          {showFlatPriceTip && <p className="text-base">Nothing on the bill yet. Add a row below. For one all-in price, use &ldquo;One flat price&rdquo; and set the prices to &ldquo;{taxLabel} included&rdquo;.</p>}

          <div className="space-y-3">
            {displayRows.map((d) => {
              if (d.part) {
                const p = d.part;
                const price = Number(partPrices[p.id] ?? p.unitSellPrice ?? "0");
                return (
                  <div key={d.key} className="rounded-xl p-4 space-y-2" style={{ background: "var(--bg-surface)", border: "1.5px solid var(--text-primary)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-lg font-bold">{p.name}</div>
                      <span className="text-sm font-extrabold uppercase tracking-wide">{KIND_TAG.part}</span>
                    </div>
                    <div className="flex items-end gap-4 flex-wrap">
                      <div className="w-24">
                        <div className="text-sm font-bold mb-1">Qty</div>
                        <div className="text-lg font-bold tabular-nums py-2">{p.quantity}</div>
                      </div>
                      <div className="w-36">
                        <label htmlFor={`price-${p.id}`} className="block text-sm font-bold mb-1">
                          Price each ($)
                        </label>
                        <input id={`price-${p.id}`} type="number" step="0.01" min="0" inputMode="decimal" value={partPrices[p.id] ?? p.unitSellPrice ?? ""} onChange={(e) => setPartPrices((cur) => ({ ...cur, [p.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg font-mono" />
                      </div>
                      <div className="flex-1 min-w-[6rem]">
                        <div className="text-sm font-bold mb-1">Total</div>
                        <div className="text-xl font-extrabold tabular-nums py-1.5">{Number.isFinite(price) ? money(price * p.quantity) : "—"}</div>
                      </div>
                      <button type="button" onClick={() => removePart(p)} disabled={pending} className={dangerButton}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              }
              const t = d.typed!;
              const q = Number(t.quantity);
              const pr = Number(t.unitPrice);
              const lineTotal = q > 0 && t.unitPrice.trim() !== "" && Number.isFinite(pr) ? money(q * pr) : "—";
              return (
                <div key={d.key} className="rounded-xl p-4 space-y-2" style={{ background: "var(--bg-surface)", border: "1.5px solid var(--text-primary)" }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <label htmlFor={`desc-${t.key}`} className="sr-only">
                        Name of this charge
                      </label>
                      <input
                        id={`desc-${t.key}`}
                        value={t.description}
                        onChange={(e) => updateTyped(t.key, { description: e.target.value })}
                        placeholder={t.kind === "other" ? "e.g. New oil, shop supplies" : "Name on the invoice"}
                        className="w-full px-3 py-2 rounded-lg font-bold"
                        autoFocus={t.description === "" && t.kind === "other"}
                      />
                    </div>
                    <span className="text-sm font-extrabold uppercase tracking-wide pt-3">{KIND_TAG[t.kind]}</span>
                  </div>
                  <div className="flex items-end gap-4 flex-wrap">
                    <div className="w-24">
                      <label htmlFor={`qty-${t.key}`} className="block text-sm font-bold mb-1">
                        {t.kind === "labour" ? "Hours" : "Qty"}
                      </label>
                      <input id={`qty-${t.key}`} type="number" step={t.kind === "labour" ? "0.25" : "1"} min="0" inputMode="decimal" value={t.quantity} onChange={(e) => updateTyped(t.key, { quantity: e.target.value })} className="w-full px-3 py-2 rounded-lg font-mono" />
                    </div>
                    <div className="w-36">
                      <label htmlFor={`price-${t.key}`} className="block text-sm font-bold mb-1">
                        {t.kind === "labour" ? "Rate per hour ($)" : "Price each ($)"}
                      </label>
                      <input id={`price-${t.key}`} type="number" step="0.01" min="0" inputMode="decimal" value={t.unitPrice} onChange={(e) => updateTyped(t.key, { unitPrice: e.target.value })} className="w-full px-3 py-2 rounded-lg font-mono" />
                    </div>
                    <div className="flex-1 min-w-[6rem]">
                      <div className="text-sm font-bold mb-1">Total</div>
                      <div className="text-xl font-extrabold tabular-nums py-1.5">{lineTotal}</div>
                    </div>
                    <button type="button" onClick={() => removeTyped(t.key)} className={dangerButton}>
                      Remove
                    </button>
                  </div>
                  {t.kind === "labour" && t.unitPrice === "" && <p className="text-sm font-bold" style={{ color: "var(--color-warning-solid)" }}>No hourly rate is set in Shop Profile. Type the rate for this job.</p>}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={addLabour} className={secondaryButton}>
              + Labour
            </button>
            {services.length > 0 && (
              <button type="button" onClick={() => setPicker(picker === "service" ? null : "service")} className={secondaryButton}>
                + Service
              </button>
            )}
            <button type="button" onClick={() => setPicker(picker === "part" ? null : "part")} className={secondaryButton}>
              + Part
            </button>
            <button type="button" onClick={() => addTyped({ kind: "other", description: "", quantity: "1", unitPrice: "", taxable: true })} className={secondaryButton}>
              + Other charge
            </button>
            <button type="button" onClick={() => addTyped({ kind: "other", description: "Repair service", quantity: "1", unitPrice: "", taxable: true })} className={secondaryButton}>
              + One flat price
            </button>
            {diagnosticFee ? (
              <button type="button" disabled={typed.some((t) => t.description === "Diagnostic fee")} onClick={() => addTyped({ kind: "other", description: "Diagnostic fee", quantity: "1", unitPrice: diagnosticFee.toFixed(2), taxable: true })} className={secondaryButton}>
                + Diagnostic fee ({money(diagnosticFee)})
              </button>
            ) : null}
            {showDeliveryFee && !typed.some((t) => t.description === "Pickup/delivery fee") && (
              <button type="button" onClick={() => addTyped({ kind: "other", description: "Pickup/delivery fee", quantity: "1", unitPrice: deliveryFeeDefault.trim() ? Number(deliveryFeeDefault).toFixed(2) : "", taxable: true })} className={secondaryButton}>
                + Pickup/delivery fee
              </button>
            )}
          </div>

          {picker === "service" && (
            <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--bg-surface)", border: "2px solid var(--text-primary)" }}>
              <label htmlFor="bill-service" className="block text-sm font-bold">
                Pick a saved service
              </label>
              <SearchSelect id="bill-service" value={serviceId} onChange={pickService} placeholder="Type to find a service, e.g. Snowblower…" options={services.map((s) => ({ value: s.id, label: s.name, hint: money(s.price), keywords: s.description ?? "" }))} />
            </div>
          )}
          {picker === "part" && <AddPartPicker workOrderId={workOrderId} availableParts={availableParts} onDone={() => setPicker(null)} />}

          {/* ---- tax rule and totals */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-surface)", border: "1.5px solid var(--text-primary)" }}>
            {taxRate > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-base font-extrabold">The prices I type are:</span>
                <Segmented
                  value={taxMode}
                  onChange={setTaxMode}
                  label="Do the prices include tax?"
                  options={[
                    { value: "before", label: `Before ${taxLabel}` },
                    { value: "included", label: `${taxLabel} included` },
                  ]}
                />
              </div>
            )}
            <div className="space-y-1 text-lg tabular-nums max-w-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{hasBill ? `$${bill.totals.subtotal}` : "$0.00"}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between">
                  <span>
                    {taxLabel} ({taxRate}%)
                  </span>
                  <span>{hasBill ? `$${bill.totals.taxAmount}` : "$0.00"}</span>
                </div>
              )}
              <div className="flex justify-between text-2xl font-extrabold pt-1" style={{ borderTop: "2px solid var(--text-primary)" }}>
                <span>Total</span>
                <span>{total}</span>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="bill-notes" className="block text-lg font-extrabold mb-1.5">
              Notes on the invoice
            </label>
            <textarea id="bill-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was done. The customer sees this in a box on their invoice." className="w-full px-4 py-3 rounded-xl" />
          </div>
        </div>

        {/* ---- the invoice, as the customer will see it */}
        <div className="lg:sticky lg:top-4 min-w-0">
          <h3 className="text-xl font-extrabold mb-2">What the customer will get</h3>
          <div className="rounded-xl p-5 space-y-4" style={{ background: "#fff", border: "1.5px solid #0f172a", color: "#0f172a" }} aria-label="Invoice preview">
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="text-xl font-extrabold">{shopName}</div>
                <div className="text-base">Invoice (draft)</div>
              </div>
              <div className="text-base text-right">
                <div className="font-bold">{customerName}</div>
                <div>{equipmentLabel}</div>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-base" style={{ borderTop: "2px solid #0f172a" }}>
              <thead>
                <tr className="text-left">
                  <th className="py-1.5 pr-2 font-extrabold">Item</th>
                  <th className="py-1.5 px-2 font-extrabold text-right">Qty</th>
                  <th className="py-1.5 px-2 font-extrabold text-right">Price</th>
                  <th className="py-1.5 pl-2 font-extrabold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.lines.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 italic">
                      Rows you add appear here.
                    </td>
                  </tr>
                )}
                {bill.lines.map((l) => (
                  <tr key={l.sortOrder} style={{ borderTop: "1px solid #94a3b8" }}>
                    <td className="py-1.5 pr-2 font-semibold">{l.description}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{Number(l.quantity)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">${l.unitPrice}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums font-bold">${l.lineTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="ml-auto max-w-[16rem] text-base tabular-nums space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${hasBill ? bill.totals.subtotal : "0.00"}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between">
                  <span>{taxLabel}</span>
                  <span>${hasBill ? bill.totals.taxAmount : "0.00"}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-extrabold pt-1" style={{ borderTop: "2px solid #0f172a" }}>
                <span>Total</span>
                <span>{total}</span>
              </div>
            </div>
            {notes.trim() && (
              <div className="rounded-lg p-3" style={{ border: "2px solid #0f172a" }}>
                <div className="text-sm font-extrabold uppercase tracking-wide mb-1">Notes</div>
                <p className="text-base whitespace-pre-wrap">{notes.trim()}</p>
              </div>
            )}
            <div className="text-center pt-3" style={{ borderTop: "1px solid #94a3b8" }}>
              <div className="text-lg font-extrabold">Thank you for your business</div>
              {hstNumber && <div className="text-base font-bold">HST/GST #{hstNumber}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ---- who pays */}
      {warrantyProviders.length > 0 && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-surface)", border: "1.5px solid var(--text-primary)" }}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-base font-extrabold">Who pays?</span>
            <Segmented
              value={payer}
              onChange={(v) => {
                setPayer(v);
                if (v === "warranty") setTakingPayment(false);
              }}
              label="Who pays for this job?"
              options={[
                { value: "customer", label: "The customer" },
                { value: "warranty", label: "A warranty provider" },
              ]}
            />
          </div>
          {payer === "warranty" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-bold">
                Warranty provider
                <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg font-semibold">
                  <option value="">Choose…</option>
                  {warrantyProviders.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold">
                Claim number (optional)
                <input value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg" />
              </label>
              <label className="flex items-center gap-2 text-base font-bold sm:col-span-2">
                <input type="checkbox" checked={claimTook} onChange={(e) => setClaimTook(e.target.checked)} style={{ accentColor: "#0F52BA", width: "1.25rem", height: "1.25rem" }} />
                The customer already took the machine home
              </label>
            </div>
          )}
        </div>
      )}

      {/* ---- take payment now */}
      {takingPayment && payer === "customer" && (
        <div className="rounded-xl p-4 space-y-4" style={{ background: "var(--bg-surface)", border: "2px solid var(--text-primary)" }}>
          <h3 className="text-xl font-extrabold">Take payment</h3>
          <div role="radiogroup" aria-label="Did the customer take the machine?" className="grid gap-3 sm:grid-cols-2">
            {[
              { value: "took" as const, title: "Customer paid and took it", text: "Paid at the counter, machine goes home." },
              { value: "later" as const, title: "Customer paid, will pick it up later", text: "Paid now, machine waits on the shelf." },
            ].map((o) => {
              const on = outcome === o.value;
              return (
                <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => setOutcome(o.value)} className="text-left rounded-xl px-4 py-3" style={on ? { background: "var(--color-info-subtle)", border: "3px solid var(--color-brand-600)" } : { background: "var(--bg-surface)", border: "1.5px solid var(--text-primary)" }}>
                  <div className="text-lg font-extrabold">{o.title}</div>
                  <div className="text-base">{o.text}</div>
                </button>
              );
            })}
          </div>
          <div>
            <div className="text-base font-extrabold mb-2">How did they pay?</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How did they pay?">
              {PAYMENT_METHODS.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className="px-5 py-2.5 rounded-full text-lg font-extrabold" style={method === m ? { background: "var(--color-brand-600)", color: "#fff", border: "2px solid var(--color-brand-600)" } : { background: "var(--bg-surface)", color: "var(--text-primary)", border: "2px solid var(--text-primary)" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          {(method === "E-transfer" || method === "Cheque") && (
            <label className="block max-w-sm text-sm font-bold">
              {method === "Cheque" ? "Cheque number (optional)" : "E-transfer confirmation (optional)"}
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg" />
            </label>
          )}
          {customerEmail && (
            <label className="flex items-center gap-2 text-base font-bold">
              <input type="checkbox" checked={emailReceipt} onChange={(e) => setEmailReceipt(e.target.checked)} style={{ accentColor: "#0F52BA", width: "1.25rem", height: "1.25rem" }} />
              Email a receipt to {customerEmail}
            </label>
          )}
          <button type="button" onClick={() => submit(true)} disabled={pending} className="px-8 py-4 rounded-xl text-xl font-extrabold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
            {pending ? "Saving…" : `Take ${total} and finish`}
          </button>
        </div>
      )}

      <div ref={errorRef}>
        {error && (
          <p className="text-base font-bold rounded-lg px-4 py-3" style={{ color: "var(--color-error-solid)", background: "var(--color-error-subtle)", border: "1.5px solid var(--color-error-solid)" }} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => submit(false)} disabled={pending} className="px-7 py-3.5 rounded-xl text-xl font-extrabold bg-[var(--bg-surface)] border-2 border-[var(--color-brand-600)] text-brand-600 hover:bg-[var(--color-info-subtle)] disabled:opacity-60">
          {pending && !takingPayment ? "Saving…" : payer === "warranty" ? `Create claim invoice · ${total}` : "Create invoice"}
        </button>
        {payer === "customer" && !takingPayment && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setTakingPayment(true);
            }}
            disabled={pending}
            className="px-7 py-3.5 rounded-xl text-xl font-extrabold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
          >
            Create invoice and take payment
          </button>
        )}
      </div>
      {payer === "warranty" && providerName && <p className="text-base">The claim goes to {providerName}. {claimTook ? "The job moves to Done." : "The job waits Ready until the customer collects it."}</p>}

      <div className="pt-4 flex flex-wrap items-center gap-x-5 gap-y-2" style={{ borderTop: "1.5px solid var(--border-strong)" }}>
        <span className="text-base font-bold">Not ready to price?</span>
        <Link href="/work-orders" className={secondaryButton}>
          Come back later: the job stays on Billing
        </Link>
        {status === "inRepair" && (
          <button type="button" onClick={justMarkReady} disabled={pending} className={secondaryButton}>
            Mark it ready for pickup, price it later
          </button>
        )}
        {status === "readyForPickup" && (
          <span className="text-base">
            Billing this customer for more than one machine at once?{" "}
            <Link href="/invoices/new" className="font-bold text-brand-600 underline">
              Combine work orders into one invoice
            </Link>
            .
          </span>
        )}
      </div>
    </div>
  );
}
