// What was typed on a job's Billing screen, kept on the job as it is typed. Plain functions with no imports other than
// types, so they can be tested on their own.
//
// A draft holds the rows the person added or changed (labour, saved services, other charges), the prices they set on the
// job's parts, which lines are marked "no tax" (US shops), the tax choice and the notes. The job's parts themselves are not
// copied into it: they are read from the job each time, so a part added or removed later shows up correctly.

import type { BillingRow, BillingRowKind } from "./invoice-lines.ts";

export type DraftRowKind = Exclude<BillingRowKind, "part">;
export type DraftRow = { kind: DraftRowKind; description: string; quantity: string; unitPrice: string; taxable: boolean };
export type BillingDraft = {
  rows: DraftRow[];
  partPrices: Record<string, string>;
  partNoTax: Record<string, boolean>;
  taxMode: "before" | "included";
  notes: string;
};

const MAX_ROWS = 60;
const KIND_ORDER: Record<BillingRowKind, number> = { labour: 0, service: 1, part: 2, other: 3 };

/** Reads a saved or posted draft, keeping only what is valid and a sensible size. Null when it is not a draft at all. */
export function parseBillingDraft(value: unknown): BillingDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const rows: DraftRow[] = [];
  if (Array.isArray(v.rows)) {
    for (const r of v.rows.slice(0, MAX_ROWS)) {
      const row = r as Record<string, unknown>;
      const kind = row?.kind;
      if (kind !== "labour" && kind !== "service" && kind !== "other") continue;
      rows.push({
        kind,
        description: String(row.description ?? "").slice(0, 200),
        quantity: String(row.quantity ?? "").slice(0, 20),
        unitPrice: String(row.unitPrice ?? "").slice(0, 20),
        taxable: row.taxable !== false,
      });
    }
  }
  const partPrices: Record<string, string> = {};
  if (v.partPrices && typeof v.partPrices === "object" && !Array.isArray(v.partPrices)) {
    for (const [id, price] of Object.entries(v.partPrices as Record<string, unknown>).slice(0, MAX_ROWS)) partPrices[id.slice(0, 60)] = String(price ?? "").slice(0, 20);
  }
  const partNoTax: Record<string, boolean> = {};
  if (v.partNoTax && typeof v.partNoTax === "object" && !Array.isArray(v.partNoTax)) {
    for (const [id, on] of Object.entries(v.partNoTax as Record<string, unknown>).slice(0, MAX_ROWS)) if (on === true) partNoTax[id.slice(0, 60)] = true;
  }
  return { rows, partPrices, partNoTax, taxMode: v.taxMode === "included" ? "included" : "before", notes: String(v.notes ?? "").slice(0, 4000) };
}

/** A typed row counts once it has a name, a quantity and a price; a half-filled one is left out. */
function completeRow(r: DraftRow): { description: string; quantity: number; unitPrice: number } | null {
  const quantity = Number(r.quantity);
  const unitPrice = Number(r.unitPrice);
  if (!r.description.trim() || !(quantity > 0) || r.unitPrice.trim() === "" || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
  return { description: r.description.trim().slice(0, 200), quantity, unitPrice };
}

export type DraftPart = { id: string; name: string; quantity: number; unitSellPrice: string | null };

/**
 * The bill a draft stands for, as rows ready to be turned into invoice lines: the complete typed rows plus the job's parts
 * at the saved prices, in the order the Billing screen shows them (labour, services, parts, other charges). Marking a line
 * "no tax" by hand is only honoured when `canMarkNoTax` is true (US shops); a saved service keeps its own no-tax flag.
 */
export function draftBillingRows(draft: BillingDraft, parts: DraftPart[], canMarkNoTax: boolean): BillingRow[] {
  const all: BillingRow[] = [];
  for (const r of draft.rows) {
    const done = completeRow(r);
    if (!done) continue;
    const taxable = r.kind === "service" || canMarkNoTax ? r.taxable : true;
    all.push({ kind: r.kind, description: done.description, quantity: done.quantity, unitPrice: done.unitPrice, taxable });
  }
  for (const p of parts) {
    const typed = draft.partPrices[p.id];
    const price = Number(typed !== undefined ? typed : p.unitSellPrice ?? "0");
    all.push({ kind: "part", description: p.name, quantity: p.quantity, unitPrice: Number.isFinite(price) && price >= 0 ? price : 0, taxable: canMarkNoTax ? !draft.partNoTax[p.id] : true, workOrderPartId: p.id });
  }
  return all.map((row, i) => ({ row, i })).sort((a, b) => KIND_ORDER[a.row.kind] - KIND_ORDER[b.row.kind] || a.i - b.i).map((x) => x.row);
}
