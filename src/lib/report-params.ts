// What the report pages keep in the address bar: the date range, grouping, every filter, and a few per-report choices.
// Everything lives in the URL, so a filtered report can be bookmarked, shared, or reached again with Back.

import { FACETS, PRESETS, emptyFilters, type Basis, type FacetKey, type Group, type Preset, type ReportFilters, type ReportKind, type SalesDimension, SALES_DIMENSIONS } from "./report-engine.ts";

export interface ReportParams {
  preset: Preset;
  from: string;
  to: string;
  group: Group;
  compare: boolean;
  filters: ReportFilters;
  dim: SalesDimension;
  detail: "invoice" | "line";
  basis: Basis;
  itc: boolean;
  all: boolean;
}

export type RawParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const SEP = "|";
const num = (s: string) => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function parseParams(raw: RawParams): ReportParams {
  const preset = (PRESETS as readonly string[]).includes(one(raw.preset)) ? (one(raw.preset) as Preset) : "month";
  const filters = emptyFilters();
  for (const d of FACETS) {
    const v = one(raw[d.key]);
    if (v) filters.sets[d.key] = v.split(SEP).filter(Boolean);
  }
  filters.customer = one(raw.cust);
  filters.invoiceNo = one(raw.inv);
  filters.min = num(one(raw.min));
  filters.max = num(one(raw.max));
  const group = ["day", "week", "month"].includes(one(raw.group)) ? (one(raw.group) as Group) : "day";
  const dim = SALES_DIMENSIONS.some((d) => d.key === one(raw.dim)) ? (one(raw.dim) as SalesDimension) : "customer";
  return {
    preset, from: one(raw.from), to: one(raw.to), group, compare: one(raw.cmp) !== "0", filters, dim,
    detail: one(raw.detail) === "line" ? "line" : "invoice", basis: one(raw.basis) === "payment" ? "payment" : "invoice", itc: one(raw.itc) !== "0", all: one(raw.all) === "1",
  };
}

/** The query string for these parameters, leaving out whatever is the default. `change` is applied on top first. */
export function toQuery(p: ReportParams, change: Partial<Record<string, string | null>> = {}): string {
  const q = new URLSearchParams();
  const put = (k: string, v: string | null | undefined) => { if (v) q.set(k, v); };
  if (p.preset !== "month") put("preset", p.preset);
  if (p.preset === "custom") { put("from", p.from); put("to", p.to); }
  if (p.group !== "day") put("group", p.group);
  if (!p.compare) put("cmp", "0");
  for (const d of FACETS) { const v = p.filters.sets[d.key]; if (v?.length) put(d.key, v.join(SEP)); }
  put("cust", p.filters.customer.trim());
  put("inv", p.filters.invoiceNo.trim());
  if (p.filters.min !== null) put("min", String(p.filters.min));
  if (p.filters.max !== null) put("max", String(p.filters.max));
  if (p.dim !== "customer") put("dim", p.dim);
  if (p.detail !== "invoice") put("detail", p.detail);
  if (p.basis !== "invoice") put("basis", p.basis);
  if (!p.itc) put("itc", "0");
  if (p.all) put("all", "1");
  for (const [k, v] of Object.entries(change)) {
    if (v === null || v === undefined || v === "") q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** The link that adds or removes one value of a facet (a technician, a payment method, …) from the filters. */
export function toggleFacet(p: ReportParams, key: FacetKey, value: string): string {
  const cur = p.filters.sets[key] ?? [];
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  return toQuery(p, { [key]: next.join(SEP) || null, all: null });
}

/** The link that narrows the report to exactly one value (clicking a row in a summary table). */
export function onlyFacet(p: ReportParams, key: FacetKey, value: string): string {
  return toQuery(p, { [key]: value, all: null });
}

export const hasKind = (k: FacetKey, report: ReportKind) => FACETS.find((d) => d.key === k)!.reports.includes(report);
