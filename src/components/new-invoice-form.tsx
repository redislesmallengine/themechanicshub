"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createStandaloneInvoice, generateCombinedInvoice, listInvoiceableWorkOrders } from "@/app/(app)/invoices/actions";
import { InvoiceIcon } from "@/components/icons";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

interface CustomerWithEquipment {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  equipment: { id: string; label: string }[];
}

interface InvoiceableWorkOrder {
  id: string;
  label: string;
  complaint: string;
}

export function NewInvoiceForm({
  customers,
  hasDiagnosticFee,
  initialCustomerId,
}: {
  customers: CustomerWithEquipment[];
  hasDiagnosticFee: boolean;
  initialCustomerId?: string;
}) {
  const [mode, setMode] = useState<"blank" | "combine">("blank");
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-0.5 rounded-lg w-fit" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => setMode("blank")}
          className="px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors"
          style={mode === "blank" ? { background: "var(--bg-surface)", color: "var(--text-primary)", boxShadow: "var(--shadow-sm)" } : { color: "var(--text-muted)" }}
        >
          Blank Invoice
        </button>
        <button
          type="button"
          onClick={() => setMode("combine")}
          className="px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors"
          style={mode === "combine" ? { background: "var(--bg-surface)", color: "var(--text-primary)", boxShadow: "var(--shadow-sm)" } : { color: "var(--text-muted)" }}
        >
          Combine Work Orders
        </button>
      </div>

      {mode === "blank" ? (
        <BlankInvoiceForm customers={customers} customerId={customerId} setCustomerId={setCustomerId} />
      ) : (
        <CombineWorkOrdersForm customers={customers} customerId={customerId} setCustomerId={setCustomerId} hasDiagnosticFee={hasDiagnosticFee} />
      )}
    </div>
  );
}

function BlankInvoiceForm({
  customers,
  customerId,
  setCustomerId,
}: {
  customers: CustomerWithEquipment[];
  customerId: string;
  setCustomerId: (id: string) => void;
}) {
  const router = useRouter();
  const [equipmentId, setEquipmentId] = useState("");
  const [adHocEquipmentLabel, setAdHocEquipmentLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createStandaloneInvoice(formData);
      // createStandaloneInvoice redirects on success, so reaching here means it didn't
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-brand-50 text-brand-600">
            <InvoiceIcon className="w-4 h-4" />
          </span>
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            New Invoice
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label htmlFor="customerId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Customer — optional
          </label>
          <select
            id="customerId"
            name="customerId"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setEquipmentId(""); // the previously-picked equipment may not belong to the newly-picked customer
            }}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold"
            style={inputStyle}
          >
            <option value="">No customer (walk-in / cash sale)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `— ${c.phone}` : c.email ? `— ${c.email}` : ""}
              </option>
            ))}
          </select>
          <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
            Leave blank for a counter sale — the invoice will show &ldquo;No Customer Info&rdquo; in place of a name.
          </span>
        </div>

        <div>
          <label htmlFor="equipmentId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Equipment — optional
          </label>
          <select
            id="equipmentId"
            name="equipmentId"
            value={equipmentId}
            disabled={!selectedCustomer || !!adHocEquipmentLabel}
            onChange={(e) => setEquipmentId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
            style={inputStyle}
          >
            <option value="">{selectedCustomer ? "Parts only — no equipment" : "Pick a customer first"}</option>
            {selectedCustomer?.equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.label}
              </option>
            ))}
          </select>
          {selectedCustomer ? (
            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
              Only fill this in if there&apos;s a repair on this invoice.{" "}
              {selectedCustomer.equipment.length === 0 && (
                <>
                  This customer has no equipment registered yet —{" "}
                  <Link href={`/customers/${selectedCustomer.id}/equipment/new`} className="font-semibold text-brand-600">
                    add one
                  </Link>
                  .
                </>
              )}
            </span>
          ) : (
            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
              Leave blank for a plain parts sale — no machine involved.
            </span>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="adHocEquipmentLabel" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Or describe the machine — no record on file
        </label>
        <input
          id="adHocEquipmentLabel"
          name="adHocEquipmentLabel"
          type="text"
          value={adHocEquipmentLabel}
          disabled={!!equipmentId}
          onChange={(e) => setAdHocEquipmentLabel(e.target.value)}
          placeholder="e.g. Toro 20370 mower, borrowed — no equipment record"
          className="w-full px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-60"
          style={inputStyle}
        />
        <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
          For a repair with nothing on file at all — works with or without a customer picked above. Prefer the Equipment
          dropdown when the machine (or its owner) is already in the system, so it builds real service history.
        </span>
      </div>

      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        Line items — parts, labour, fees — are added on the next screen. No machine attached = a Parts Only invoice; a machine
        attached (either way above) = an Equipment Repair Service invoice, with machine details shown on it.
      </p>

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}

      <div className="pt-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => router.push("/invoices")}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60">
          {pending ? "Creating…" : "Create Invoice"}
        </button>
      </div>
    </form>
  );
}

function CombineWorkOrdersForm({
  customers,
  customerId,
  setCustomerId,
  hasDiagnosticFee,
}: {
  customers: CustomerWithEquipment[];
  customerId: string;
  setCustomerId: (id: string) => void;
  hasDiagnosticFee: boolean;
}) {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<InvoiceableWorkOrder[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingWorkOrders, startWorkOrdersTransition] = useTransition();
  // Guards against an earlier, slower request overwriting the list with a
  // stale customer's work orders if the customer is switched again before
  // the first fetch resolves.
  const latestCustomerIdRef = useRef("");

  function fetchWorkOrdersFor(targetCustomerId: string) {
    latestCustomerIdRef.current = targetCustomerId;
    startWorkOrdersTransition(async () => {
      const result = await listInvoiceableWorkOrders(targetCustomerId).catch(() => ({ success: true as const, workOrders: [] as InvoiceableWorkOrder[] }));
      if (latestCustomerIdRef.current === targetCustomerId) setWorkOrders(result.workOrders);
    });
  }

  function handleCustomerChange(id: string) {
    setCustomerId(id);
    setSelectedIds(new Set());
    setWorkOrders([]);
    if (!id) {
      latestCustomerIdRef.current = "";
      return;
    }
    fetchWorkOrdersFor(id);
  }

  // Prefetch once on mount for a customer pre-selected via ?customerId= on
  // the New Invoice page — every other fetch is driven by the picker's
  // onChange, deliberately not this effect re-running.
  useEffect(() => {
    if (customerId) fetchWorkOrdersFor(customerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleWorkOrder(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await generateCombinedInvoice(customerId, formData);
      // generateCombinedInvoice redirects on success, so reaching here means it didn't
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-brand-50 text-brand-600">
            <InvoiceIcon className="w-4 h-4" />
          </span>
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            Combine Work Orders
          </h3>
        </div>
      </div>

      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        Bill one customer for 2 or more finished machines on a single invoice — each machine&apos;s labor and parts stay in
        their own clearly labeled section.
      </p>

      <div className="text-xs">
        <label htmlFor="combineCustomerId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
          Customer
        </label>
        <select
          id="combineCustomerId"
          value={customerId}
          onChange={(e) => handleCustomerChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold"
          style={inputStyle}
        >
          <option value="">Pick a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.phone ? `— ${c.phone}` : c.email ? `— ${c.email}` : ""}
            </option>
          ))}
        </select>
      </div>

      {customerId && (
        <div>
          <div className="block font-bold mb-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            Ready-to-invoice work orders
          </div>
          {loadingWorkOrders ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Loading…
            </p>
          ) : workOrders.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              This customer has no finished work orders (Repair Completed or Closed) waiting to be invoiced.
            </p>
          ) : workOrders.length === 1 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Only one work order is ready — combining needs at least 2. Invoice it directly from its work order page instead.
            </p>
          ) : (
            <div className="space-y-1.5">
              {workOrders.map((wo) => (
                <label
                  key={wo.id}
                  className="flex items-start gap-2 p-2.5 rounded-lg text-xs cursor-pointer"
                  style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}
                >
                  <input
                    type="checkbox"
                    name="workOrderIds"
                    value={wo.id}
                    checked={selectedIds.has(wo.id)}
                    onChange={() => toggleWorkOrder(wo.id)}
                    className="mt-0.5 rounded"
                    style={{ accentColor: "#0F52BA" }}
                  />
                  <span>
                    <span className="font-bold block" style={{ color: "var(--text-primary)" }}>
                      {wo.label}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{wo.complaint}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {hasDiagnosticFee && selectedIds.size > 0 && (
        <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" name="includeDiagnosticFee" className="rounded" style={{ accentColor: "#0F52BA" }} />
          Include a diagnostic fee for each machine
        </label>
      )}

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}

      <div className="pt-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => router.push("/invoices")}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || selectedIds.size < 2}
          className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60"
        >
          {pending ? "Creating…" : selectedIds.size < 2 ? "Select 2+ Work Orders" : `Combine ${selectedIds.size} into One Invoice`}
        </button>
      </div>
    </form>
  );
}
