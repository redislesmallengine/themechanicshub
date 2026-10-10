"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createQuickJob } from "@/app/(app)/work-orders/quick/actions";
import { PAYMENT_METHODS } from "@/lib/invoices";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};
const labelStyle = { color: "var(--text-secondary)" };

interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  equipment: { id: string; label: string }[];
}

interface PartOption {
  id: string;
  name: string;
  quantityOnHand: number;
  sellPrice: number;
}

interface ShopRates {
  labourRate: number | null;
  diagnosticFee: number | null;
  deliveryFeeDefault: string;
  taxRate: number;
  taxLabel: string;
}

const STEP_NAMES = ["diagnosed", "approved", "repaired", "billed", "paid", "pickedUp"] as const;
const STEP_TITLES = ["Diagnosed", "Customer OK'd it", "Repaired", "Billed", "Paid", "Picked up"];
const STEP_HINTS = ["technician · hours · notes", "in person, no written estimate", "work performed · parts", "creates the invoice", "method · reference", "closes the work order"];

const money = (n: number) => `$${n.toFixed(2)}`;
const lastTenDigits = (s: string | null) => (s ?? "").replace(/\D/g, "").slice(-10);

export function QuickJobForm({
  customers,
  initialCustomerId,
  equipmentTypes,
  makes,
  members,
  currentUserId,
  parts,
  shop,
}: {
  customers: CustomerOption[];
  initialCustomerId: string;
  equipmentTypes: { id: string; name: string }[];
  makes: string[];
  members: { userId: string; name: string }[];
  currentUserId: string;
  parts: PartOption[];
  shop: ShopRates;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [equipmentId, setEquipmentId] = useState("");
  const [addNewEquipment, setAddNewEquipment] = useState(false);
  const [newPhone, setNewPhone] = useState("");

  const [steps, setSteps] = useState<boolean[]>([false, false, false, false, false, false]);
  const [hours, setHours] = useState("");
  const [diagnosisNotes, setDiagnosisNotes] = useState("");
  const [repairNotes, setRepairNotes] = useState("");
  const [usedParts, setUsedParts] = useState<{ partId: string; name: string; quantity: number; price: number }[]>([]);
  const [pickPartId, setPickPartId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [feeDiag, setFeeDiag] = useState(true);
  const [feeDelivery, setFeeDelivery] = useState(false);
  const [deliveryAmount, setDeliveryAmount] = useState(shop.deliveryFeeDefault);
  const [emailReceipt, setEmailReceipt] = useState(false);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);
  const hasTechnicianChoice = members.length > 1;
  const defaultTechnician = members.some((m) => m.userId === currentUserId) ? currentUserId : "";

  // Equipment is forced to "new" for a brand-new customer, or when the chosen customer has none yet.
  const equipmentMode: "existing" | "new" =
    customerMode === "new" || (selectedCustomer && (selectedCustomer.equipment.length === 0 || addNewEquipment)) ? "new" : "existing";

  const duplicate = useMemo(() => {
    const digits = lastTenDigits(newPhone);
    if (customerMode !== "new" || digits.length < 7) return null;
    return customers.find((c) => lastTenDigits(c.phone) === digits) ?? null;
  }, [customerMode, newPhone, customers]);

  // Ticking a step ticks the ones before it; unticking clears the ones after it. Paid and Picked up are
  // separate branches after Billed, so a customer can take the machine and pay later.
  function toggleStep(i: number) {
    setSteps((prev) => {
      const next = [...prev];
      if (!prev[i]) {
        const upTo = i === 5 ? 3 : i;
        for (let k = 0; k <= upTo; k++) next[k] = true;
        next[i] = true;
      } else if (i <= 3) {
        for (let k = i; k < 6; k++) next[k] = false;
      } else {
        next[i] = false;
      }
      return next;
    });
  }

  function addPart() {
    const part = parts.find((p) => p.id === pickPartId);
    const quantity = Number(pickQty);
    if (!part || !Number.isInteger(quantity) || quantity <= 0) return;
    setUsedParts((prev) => {
      const existing = prev.find((p) => p.partId === part.id);
      if (existing) return prev.map((p) => (p.partId === part.id ? { ...p, quantity: p.quantity + quantity } : p));
      return [...prev, { partId: part.id, name: part.name, quantity, price: part.sellPrice }];
    });
    setPickPartId("");
    setPickQty("1");
  }

  const [diagnosed, approved, repaired, billed, paid, pickedUp] = steps;

  // An estimate of the invoice -- the real numbers are worked out when the job is saved.
  const preview = useMemo(() => {
    const lines: { label: string; amount: number }[] = [];
    const hoursNum = Number(hours);
    if (shop.labourRate && Number.isFinite(hoursNum) && hoursNum > 0) lines.push({ label: `Labour ${hoursNum} hr × ${money(shop.labourRate)}`, amount: hoursNum * shop.labourRate });
    for (const p of usedParts) lines.push({ label: `${p.name} × ${p.quantity}`, amount: p.price * p.quantity });
    if (feeDiag && shop.diagnosticFee) lines.push({ label: "Diagnostic fee", amount: shop.diagnosticFee });
    const delivery = Number(deliveryAmount);
    if (feeDelivery && Number.isFinite(delivery) && delivery > 0) lines.push({ label: "Pickup/delivery fee", amount: delivery });
    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
    const tax = Math.round(subtotal * shop.taxRate) / 100;
    return { lines, tax, total: subtotal + tax };
  }, [hours, usedParts, feeDiag, feeDelivery, deliveryAmount, shop]);

  const status = pickedUp ? "Picked Up / Closed" : repaired ? "Repair Completed" : approved ? "In Repair" : diagnosed ? "Diagnosing" : "Pending";
  const summary: string[] = [
    customerMode === "new" ? "Registers the new customer" : null,
    equipmentMode === "new" ? "Registers the new equipment" : null,
    "Creates the work order",
    diagnosed ? "Saves the diagnosis, hours and technician" : null,
    approved ? "Records the go-ahead as given in person" : null,
    repaired ? `Saves the work performed${usedParts.length ? " and takes the parts out of stock" : ""}` : null,
    billed ? "Creates the invoice, numbered in sequence" : null,
    paid ? `Marks the invoice paid${emailReceipt ? " and emails a receipt" : ""}` : null,
    pickedUp ? "Closes the work order as picked up" : null,
  ].filter((l): l is string => l !== null);

  // onSubmit rather than <form action>: React 19 resets the fields after an action finishes, and a
  // failed save (say a missing payment method) must not wipe what was typed.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("customerMode", customerMode);
    formData.set("equipmentMode", equipmentMode);
    formData.set("parts", JSON.stringify(usedParts.map((p) => ({ partId: p.partId, quantity: p.quantity }))));
    setError(null);
    startTransition(async () => {
      const result = await createQuickJob(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.success) {
        if (result.warning) window.alert(result.warning);
        router.push(result.redirectTo);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start max-w-6xl">
      <div className="space-y-4 min-w-0">
        {/* ---- the machine */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wide" style={labelStyle}>
            The machine
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              {customerMode === "existing" ? (
                <div>
                  <label htmlFor="customerId" className="block font-bold mb-1" style={labelStyle}>
                    Customer <span style={{ color: "var(--color-error-solid)" }}>*</span>
                  </label>
                  <select
                    id="customerId"
                    name="customerId"
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      setEquipmentId("");
                      setAddNewEquipment(false);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold"
                    style={inputStyle}
                  >
                    <option value="">Select…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `— ${c.phone}` : c.email ? `— ${c.email}` : ""}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setCustomerMode("new")} className="mt-1 text-[11px] font-bold text-brand-600">
                    + New customer
                  </button>
                </div>
              ) : (
                <div className="rounded-lg p-3 space-y-2" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)" }}>
                  <div className="font-bold" style={labelStyle}>
                    New customer
                  </div>
                  <div>
                    <label htmlFor="newCustomerName" className="block font-bold mb-1" style={labelStyle}>
                      Name <span style={{ color: "var(--color-error-solid)" }}>*</span>
                    </label>
                    <input id="newCustomerName" name="newCustomerName" type="text" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={{ ...inputStyle, background: "var(--bg-surface)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="newCustomerPhone" className="block font-bold mb-1" style={labelStyle}>
                        Phone
                      </label>
                      <input
                        id="newCustomerPhone"
                        name="newCustomerPhone"
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ ...inputStyle, background: "var(--bg-surface)" }}
                      />
                    </div>
                    <div>
                      <label htmlFor="newCustomerEmail" className="block font-bold mb-1" style={labelStyle}>
                        Email
                      </label>
                      <input id="newCustomerEmail" name="newCustomerEmail" type="email" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={{ ...inputStyle, background: "var(--bg-surface)" }} />
                    </div>
                  </div>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    A phone number or an email is needed.
                  </p>
                  {duplicate && (
                    <div className="rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ background: "var(--color-warning-subtle)", color: "var(--color-warning-solid)" }}>
                      {duplicate.name} already has this phone number.{" "}
                      <button
                        type="button"
                        className="underline font-bold"
                        onClick={() => {
                          setCustomerMode("existing");
                          setCustomerId(duplicate.id);
                          setEquipmentId("");
                          setAddNewEquipment(false);
                        }}
                      >
                        Use {duplicate.name}
                      </button>
                    </div>
                  )}
                  <button type="button" onClick={() => setCustomerMode("existing")} className="text-[11px] font-bold text-brand-600">
                    ← Pick an existing customer instead
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {equipmentMode === "existing" ? (
                <div>
                  <label htmlFor="equipmentId" className="block font-bold mb-1" style={labelStyle}>
                    Equipment <span style={{ color: "var(--color-error-solid)" }}>*</span>
                  </label>
                  <select
                    id="equipmentId"
                    name="equipmentId"
                    value={equipmentId}
                    onChange={(e) => setEquipmentId(e.target.value)}
                    disabled={!selectedCustomer}
                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
                    style={inputStyle}
                  >
                    <option value="">{selectedCustomer ? "Select…" : "Pick a customer first"}</option>
                    {selectedCustomer?.equipment.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.label}
                      </option>
                    ))}
                  </select>
                  {selectedCustomer && (
                    <button type="button" onClick={() => setAddNewEquipment(true)} className="mt-1 text-[11px] font-bold text-brand-600">
                      + New equipment
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-lg p-3 space-y-2" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)" }}>
                  <div className="font-bold" style={labelStyle}>
                    New equipment
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="newEquipmentTypeId" className="block font-bold mb-1" style={labelStyle}>
                        Type
                      </label>
                      <select id="newEquipmentTypeId" name="newEquipmentTypeId" defaultValue="" className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={{ ...inputStyle, background: "var(--bg-surface)" }}>
                        <option value="">—</option>
                        {equipmentTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="newEquipmentMake" className="block font-bold mb-1" style={labelStyle}>
                        Make
                      </label>
                      <select id="newEquipmentMake" name="newEquipmentMake" defaultValue="" className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={{ ...inputStyle, background: "var(--bg-surface)" }}>
                        <option value="">—</option>
                        {makes.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="newEquipmentModel" className="block font-bold mb-1" style={labelStyle}>
                        Model
                      </label>
                      <input id="newEquipmentModel" name="newEquipmentModel" type="text" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={{ ...inputStyle, background: "var(--bg-surface)" }} />
                    </div>
                    <div>
                      <label htmlFor="newEquipmentSerial" className="block font-bold mb-1" style={labelStyle}>
                        Serial # (optional)
                      </label>
                      <input id="newEquipmentSerial" name="newEquipmentSerial" type="text" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={{ ...inputStyle, background: "var(--bg-surface)" }} />
                    </div>
                  </div>
                  {customerMode === "existing" && selectedCustomer && selectedCustomer.equipment.length > 0 && (
                    <button type="button" onClick={() => setAddNewEquipment(false)} className="text-[11px] font-bold text-brand-600">
                      ← Pick one of their machines instead
                    </button>
                  )}
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Add a photo, engine details and more later from the equipment page.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs">
            <label htmlFor="complaint" className="block font-bold mb-1" style={labelStyle}>
              Complaint <span style={{ color: "var(--color-error-solid)" }}>*</span>
            </label>
            <textarea id="complaint" name="complaint" rows={2} placeholder="What the customer says is wrong" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
          </div>
        </div>

        {/* ---- what has happened */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wide" style={labelStyle}>
            What has happened so far?
          </h2>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Tick every step that is already done. Nothing ticked just drops the machine off as Pending.
          </p>

          {STEP_NAMES.map((name, i) => (
            <div
              key={name}
              className="rounded-lg"
              style={{ border: `1px solid ${steps[i] ? "var(--color-brand-600)" : "var(--border-subtle)"}`, background: steps[i] ? "var(--color-brand-50, var(--bg-surface-subtle))" : "var(--bg-surface)" }}
            >
              <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer">
                <input type="checkbox" name={`step_${name}`} checked={steps[i]} onChange={() => toggleStep(i)} className="w-4 h-4" style={{ accentColor: "#0F52BA" }} />
                <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {STEP_TITLES[i]}
                </span>
                <span className="ml-auto text-[10px] text-right" style={{ color: "var(--text-muted)" }}>
                  {STEP_HINTS[i]}
                </span>
              </label>

              {/* Detail fields stay mounted (just hidden) so unticking and re-ticking doesn't lose what was typed. */}
              <div hidden={!steps[i]} className="px-3 pb-3 sm:pl-10 space-y-2 text-xs">
                {name === "diagnosed" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {hasTechnicianChoice ? (
                        <div>
                          <label htmlFor="assignedToUserId" className="block font-bold mb-1" style={labelStyle}>
                            Technician
                          </label>
                          <select id="assignedToUserId" name="assignedToUserId" defaultValue={defaultTechnician} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
                            <option value="">Unassigned</option>
                            {members.map((m) => (
                              <option key={m.userId} value={m.userId}>
                                {m.name}
                                {m.userId === currentUserId ? " (me)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <input type="hidden" name="assignedToUserId" value={members[0]?.userId ?? ""} />
                          <div className="font-bold mb-1" style={labelStyle}>
                            Technician
                          </div>
                          <div className="px-3 py-2 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                            {members[0]?.name ?? "—"}
                          </div>
                        </div>
                      )}
                      <div>
                        <label htmlFor="labourHours" className="block font-bold mb-1" style={labelStyle}>
                          Labour hours
                        </label>
                        <input id="labourHours" name="labourHours" type="number" step="0.25" min="0" value={hours} onChange={(e) => setHours(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="diagnosisNotes" className="block font-bold mb-1" style={labelStyle}>
                        Diagnosis notes
                      </label>
                      <textarea id="diagnosisNotes" name="diagnosisNotes" rows={2} value={diagnosisNotes} onChange={(e) => setDiagnosisNotes(e.target.value)} placeholder="What you found" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
                    </div>
                  </>
                )}

                {name === "approved" && (
                  <>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Recorded as a go-ahead given in person by {customerMode === "new" ? "the new customer" : (selectedCustomer?.name ?? "the customer")}, with today&apos;s date.
                    </p>
                    <div className="max-w-xs">
                      <label htmlFor="notToExceedAmount" className="block font-bold mb-1" style={labelStyle}>
                        Not-to-exceed amount ($) — optional
                      </label>
                      <input id="notToExceedAmount" name="notToExceedAmount" type="number" step="0.01" min="0" placeholder="Leave blank if open-ended" className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
                    </div>
                  </>
                )}

                {name === "repaired" && (
                  <>
                    <div>
                      <label htmlFor="repairNotes" className="block font-bold mb-1" style={labelStyle}>
                        Work performed
                      </label>
                      <textarea
                        id="repairNotes"
                        name="repairNotes"
                        rows={3}
                        value={repairNotes}
                        onChange={(e) => setRepairNotes(e.target.value)}
                        placeholder={diagnosisNotes ? `Starts from the diagnosis: ${diagnosisNotes.slice(0, 60)}${diagnosisNotes.length > 60 ? "…" : ""}` : "What was done — parts replaced, adjustments, test results. This goes on the invoice."}
                        className="w-full px-3 py-2 rounded-lg text-xs font-medium"
                        style={inputStyle}
                      />
                      {!repairNotes && diagnosisNotes && (
                        <button type="button" onClick={() => setRepairNotes(diagnosisNotes)} className="mt-1 text-[11px] font-bold text-brand-600">
                          Start from the diagnosis notes
                        </button>
                      )}
                    </div>
                    <div>
                      <div className="font-bold mb-1" style={labelStyle}>
                        Parts used
                      </div>
                      {usedParts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {usedParts.map((p) => (
                            <span key={p.partId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}>
                              {p.name} × {p.quantity}
                              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setUsedParts((prev) => prev.filter((x) => x.partId !== p.partId))} style={{ color: "var(--text-muted)" }}>
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <select aria-label="Part" value={pickPartId} onChange={(e) => setPickPartId(e.target.value)} className="flex-1 min-w-[10rem] px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
                          <option value="">Add a part from inventory…</option>
                          {parts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.quantityOnHand} on hand){p.sellPrice ? ` — ${money(p.sellPrice)}` : ""}
                            </option>
                          ))}
                        </select>
                        <input aria-label="Quantity" type="number" min="1" step="1" value={pickQty} onChange={(e) => setPickQty(e.target.value)} className="w-16 px-2 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
                        <button type="button" onClick={addPart} disabled={!pickPartId} className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}>
                          Add
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {name === "billed" && (
                  <>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                      {shop.diagnosticFee ? (
                        <label className="flex items-center gap-1.5 font-semibold" style={labelStyle}>
                          <input type="checkbox" name="includeDiagnosticFee" checked={feeDiag} onChange={(e) => setFeeDiag(e.target.checked)} style={{ accentColor: "#0F52BA" }} />
                          Include diagnostic fee ({money(shop.diagnosticFee)})
                        </label>
                      ) : null}
                      <label className="flex items-center gap-1.5 font-semibold" style={labelStyle}>
                        <input type="checkbox" name="includeDeliveryFee" checked={feeDelivery} onChange={(e) => setFeeDelivery(e.target.checked)} style={{ accentColor: "#0F52BA" }} />
                        Include pickup/delivery fee
                      </label>
                      {feeDelivery && (
                        <span className="flex items-center gap-1">
                          <span style={{ color: "var(--text-muted)" }}>$</span>
                          <input aria-label="Delivery fee amount" name="deliveryFeeAmount" type="number" step="0.01" min="0" value={deliveryAmount} onChange={(e) => setDeliveryAmount(e.target.value)} placeholder="0.00" className="w-24 px-2 py-1 rounded-lg text-xs font-mono" style={inputStyle} />
                        </span>
                      )}
                    </div>
                    <div className="rounded-lg p-2.5 space-y-0.5 tabular-nums" style={{ border: "1px dashed var(--border-strong)", background: "var(--bg-surface)" }}>
                      {preview.lines.length === 0 && (
                        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          Nothing to bill yet — add labour hours or parts.
                        </div>
                      )}
                      {preview.lines.map((l) => (
                        <div key={l.label} className="flex justify-between gap-3">
                          <span style={{ color: "var(--text-secondary)" }}>{l.label}</span>
                          <span style={{ color: "var(--text-primary)" }}>{money(l.amount)}</span>
                        </div>
                      ))}
                      {shop.taxRate > 0 && preview.lines.length > 0 && (
                        <div className="flex justify-between gap-3">
                          <span style={{ color: "var(--text-secondary)" }}>
                            {shop.taxLabel} {shop.taxRate}%
                          </span>
                          <span style={{ color: "var(--text-primary)" }}>{money(preview.tax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3 pt-1 font-extrabold" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}>
                        <span>Estimated total</span>
                        <span>{money(preview.total)}</span>
                      </div>
                    </div>
                  </>
                )}

                {name === "paid" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="paymentMethod" className="block font-bold mb-1" style={labelStyle}>
                          Payment method
                        </label>
                        <select id="paymentMethod" name="paymentMethod" defaultValue="" className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
                          <option value="">Select…</option>
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="paymentReference" className="block font-bold mb-1" style={labelStyle}>
                          Reference (optional)
                        </label>
                        <input id="paymentReference" name="paymentReference" type="text" placeholder="e-transfer #, etc." className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
                      </div>
                    </div>
                    {(customerMode === "new" || selectedCustomer?.email) && (
                      <label className="flex items-center gap-1.5 font-semibold" style={labelStyle}>
                        <input type="checkbox" name="emailReceipt" checked={emailReceipt} onChange={(e) => setEmailReceipt(e.target.checked)} style={{ accentColor: "#0F52BA" }} />
                        Also email a receipt{selectedCustomer?.email ? ` to ${selectedCustomer.email}` : " (if they have an email)"}
                      </label>
                    )}
                  </>
                )}

                {name === "pickedUp" && (
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    The machine leaves the shop with the customer. The date and time are recorded automatically.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- what Save will do */}
      <aside className="rounded-xl p-4 space-y-3 lg:sticky lg:top-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }} aria-live="polite">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wide" style={labelStyle}>
          When you press Save
        </h2>
        <ol className="space-y-1.5 text-xs list-none">
          {summary.map((line) => (
            <li key={line} className="flex gap-2" style={{ color: "var(--text-primary)" }}>
              <span style={{ color: "var(--color-success-solid)" }} aria-hidden="true">
                ✓
              </span>
              {line}
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2 text-xs font-bold flex-wrap" style={{ color: "var(--text-primary)" }}>
          Ends as <span className="dt-badge dt-badge--info"><span className="dt-badge-dot" />{status}</span>
        </div>
        {pickedUp && !paid && (
          <p className="text-[11px] font-semibold rounded-lg px-3 py-2" style={{ background: "var(--color-warning-subtle)", color: "var(--color-warning-solid)" }}>
            Picked up, not paid: the invoice stays open until it is marked paid.
          </p>
        )}
        {billed && !paid && !pickedUp && (
          <p className="text-[11px] font-semibold rounded-lg px-3 py-2" style={{ background: "var(--color-warning-subtle)", color: "var(--color-warning-solid)" }}>
            The invoice is created but not paid. Send it or take payment later from the invoice page.
          </p>
        )}
        {error && (
          <p className="text-xs font-semibold rounded-lg px-3 py-2" style={{ background: "var(--color-error-subtle)", color: "var(--color-error-solid)" }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="w-full px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save quick job"}
        </button>
        <Link href="/work-orders" className="block text-center text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
          Cancel
        </Link>
      </aside>
    </form>
  );
}
