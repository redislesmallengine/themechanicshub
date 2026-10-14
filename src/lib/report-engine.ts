// The Income, Sales and HST reports: plain functions over a list of invoices, so they can be tested on their own.
//
//   Income = money received, counted on the day an invoice was paid (in full)
//   Sales  = work billed, counted on the day the invoice went out, before tax; void invoices left out
//   HST    = the tax on those sales, on the invoice date or the payment date (the shop's choice)
//
// Dates are the shop's local calendar days as "YYYY-MM-DD" strings, which sort and compare as text.

export const REVENUE_TYPES = ["Labour", "Parts", "Services (flat price)", "Fees", "Other"] as const;
export type RevenueType = (typeof REVENUE_TYPES)[number];
export type ReportKind = "income" | "sales" | "hst";
export type InvoiceState = "Paid" | "Unpaid" | "Overdue" | "Void";
export type Group = "day" | "week" | "month";

export interface ReportLine {
  type: RevenueType;
  description: string;
  qty: number;
  unitPrice: number;
  /** What the shop paid, for part lines; null when unknown or when the viewer may not see margins. */
  unitCost: number | null;
  taxable: boolean;
  total: number;
  partNumber: string | null;
  partCategory: string | null;
}

export interface ReportInvoice {
  id: string;
  number: string;
  issued: string;
  paid: string | null;
  due: string;
  state: InvoiceState;
  method: string;
  reference: string;
  customerId: string | null;
  customer: string;
  customerType: "New" | "Repeat";
  machineType: string;
  make: string;
  model: string;
  tech: string;
  job: "Normal job" | "Quick job" | "Counter sale";
  arrival: "Customer drop-off" | "Shop pickup/delivery" | "Not applicable";
  payer: "Customer" | "Warranty";
  provider: string;
  subtotal: number;
  tax: number;
  total: number;
  /** Sum of the taxable lines before tax; the tax on a partial view of the invoice is shared out by it. */
  taxableBase: number;
  lines: ReportLine[];
}

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((t, x) => t + f(x), 0);

/** Which revenue bucket an invoice line belongs to. A flat price is stored as a labour line; an hourly one reads "Labor (2 hrs @ $85.00/hr)". */
export function classifyLine(type: string, description: string): RevenueType | null {
  if (type === "part") return "Parts";
  if (type === "fee") return "Fees";
  if (type === "custom") return "Other";
  if (type === "labor") return /^labor \(/i.test(description.trim()) ? "Labour" : "Services (flat price)";
  return null; // section headers and anything else carry no money
}

// ---------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const toD = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = toD(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
export const diffDays = (a: string, b: string) => Math.round((toD(b).getTime() - toD(a).getTime()) / 864e5);
export const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
export const shortDate = (s: string) => `${MON[toD(s).getUTCMonth()]} ${toD(s).getUTCDate()}`;
export const longDate = (s: string) => `${MON[toD(s).getUTCMonth()]} ${toD(s).getUTCDate()}, ${toD(s).getUTCFullYear()}`;

/** The shop's local calendar day for an instant. */
export function toLocalDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

export const PRESETS = ["today", "week", "month", "last-month", "quarter", "last-quarter", "year", "last-year", "l30", "all", "custom"] as const;
export type Preset = (typeof PRESETS)[number];
export const PRESET_LABELS: Record<Preset, string> = {
  today: "Today",
  week: "This week",
  month: "This month so far",
  "last-month": "Last month",
  quarter: "This quarter so far",
  "last-quarter": "Last quarter",
  year: "This year so far",
  "last-year": "Last year",
  l30: "Last 30 days",
  all: "Everything",
  custom: "Pick dates…",
};
export interface DateRange {
  from: string;
  to: string;
}

const lastOfMonth = (y: number, m: number) => iso(new Date(Date.UTC(y, m, 0))); // m is 1-12: day 0 of the next month
const pad = (n: number) => String(n).padStart(2, "0");

export function resolvePreset(preset: Preset, from: string | undefined, to: string | undefined, today: string): DateRange {
  const [y, m] = today.split("-").map(Number);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: addDays(today, -((toD(today).getUTCDay() + 6) % 7)), to: today };
    case "month":
      return { from: `${y}-${pad(m)}-01`, to: today };
    case "last-month": {
      const ly = m === 1 ? y - 1 : y;
      const lm = m === 1 ? 12 : m - 1;
      return { from: `${ly}-${pad(lm)}-01`, to: lastOfMonth(ly, lm) };
    }
    case "quarter": {
      const qm = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: `${y}-${pad(qm)}-01`, to: today };
    }
    case "last-quarter": {
      const qm = Math.floor((m - 1) / 3) * 3 + 1;
      const start = qm === 1 ? { y: y - 1, m: 10 } : { y, m: qm - 3 };
      return { from: `${start.y}-${pad(start.m)}-01`, to: lastOfMonth(start.y, start.m + 2) };
    }
    case "year":
      return { from: `${y}-01-01`, to: today };
    case "last-year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "l30":
      return { from: addDays(today, -29), to: today };
    case "all":
      return { from: "2000-01-01", to: today };
    case "custom": {
      const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (!ok(from) || !ok(to)) return { from: `${y}-${pad(m)}-01`, to: today };
      return from! <= to! ? { from: from!, to: to! } : { from: to!, to: from! };
    }
  }
}

/** The stretch of equal length right before a range, for "compared with the period before". */
export function previousRange(r: DateRange): DateRange {
  const len = diffDays(r.from, r.to) + 1;
  const to = addDays(r.from, -1);
  return { from: addDays(to, -(len - 1)), to };
}

export function periodKey(d: string, g: Group): string {
  if (g === "day") return d;
  if (g === "month") return d.slice(0, 7);
  return addDays(d, -((toD(d).getUTCDay() + 6) % 7)); // the Monday of that week
}
export function periodsOf(r: DateRange, g: Group): string[] {
  const out: string[] = [];
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
    const k = periodKey(d, g);
    if (out[out.length - 1] !== k) out.push(k);
  }
  return out;
}
export function periodLabel(k: string, g: Group): string {
  if (g === "month") return `${MON[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`;
  return g === "week" ? `Wk ${shortDate(k)}` : shortDate(k);
}

// ---------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------

export type FacetKey = "ctype" | "etype" | "make" | "tech" | "job" | "arrival" | "payer" | "provider" | "method" | "state" | "ltype" | "pcat" | "tax";
export interface FacetDef {
  key: FacetKey;
  label: string;
  reports: ReportKind[];
  level: "invoice" | "line";
  values?: string[];
}
const ALL: ReportKind[] = ["income", "sales", "hst"];
export const FACETS: FacetDef[] = [
  { key: "ctype", label: "New or repeat customer", reports: ALL, level: "invoice", values: ["New", "Repeat"] },
  { key: "etype", label: "Machine type", reports: ALL, level: "invoice" },
  { key: "make", label: "Make", reports: ALL, level: "invoice" },
  { key: "tech", label: "Technician", reports: ALL, level: "invoice" },
  { key: "job", label: "Job type", reports: ALL, level: "invoice", values: ["Normal job", "Quick job", "Counter sale"] },
  { key: "arrival", label: "How it arrived", reports: ALL, level: "invoice", values: ["Customer drop-off", "Shop pickup/delivery"] },
  { key: "payer", label: "Who pays", reports: ALL, level: "invoice", values: ["Customer", "Warranty"] },
  { key: "provider", label: "Warranty provider", reports: ALL, level: "invoice" },
  { key: "method", label: "Paid by", reports: ALL, level: "invoice" },
  { key: "state", label: "Invoice status", reports: ["sales", "hst"], level: "invoice", values: ["Paid", "Unpaid", "Overdue"] },
  { key: "ltype", label: "Revenue type", reports: ALL, level: "line", values: [...REVENUE_TYPES] },
  { key: "pcat", label: "Part category", reports: ALL, level: "line" },
  { key: "tax", label: "Tax", reports: ALL, level: "line", values: ["Taxable", "Not taxable"] },
];

export interface ReportFilters {
  sets: Partial<Record<FacetKey, string[]>>;
  customer: string;
  invoiceNo: string;
  min: number | null;
  max: number | null;
}
export const emptyFilters = (): ReportFilters => ({ sets: {}, customer: "", invoiceNo: "", min: null, max: null });

export function invoiceFacetValue(inv: ReportInvoice, key: FacetKey): string {
  switch (key) {
    case "ctype": return inv.customerType;
    case "etype": return inv.machineType;
    case "make": return inv.make;
    case "tech": return inv.tech;
    case "job": return inv.job;
    case "arrival": return inv.arrival;
    case "payer": return inv.payer;
    case "provider": return inv.provider || "None";
    case "method": return inv.method || "Not paid";
    case "state": return inv.state;
    default: return "";
  }
}

/** The choices to show for every facet: the fixed list where there is one, otherwise what the invoices actually contain. */
export function facetOptions(invoices: ReportInvoice[]): Record<FacetKey, string[]> {
  const out = {} as Record<FacetKey, string[]>;
  for (const def of FACETS) {
    if (def.values) { out[def.key] = def.values; continue; }
    const seen = new Set<string>();
    for (const inv of invoices) {
      if (def.key === "pcat") inv.lines.forEach((l) => l.partCategory && seen.add(l.partCategory));
      else if (def.key === "provider") { if (inv.provider) seen.add(inv.provider); }
      else if (def.key === "method") { if (inv.method) seen.add(inv.method); }
      else seen.add(invoiceFacetValue(inv, def.key));
    }
    out[def.key] = [...seen].sort((a, b) => a.localeCompare(b));
  }
  return out;
}

export interface Shaped {
  inv: ReportInvoice;
  lines: ReportLine[];
  sub: number;
  taxable: number;
  nontax: number;
  tax: number;
  total: number;
  partsRev: number;
  /** Revenue and cost of the part lines whose cost is known, so a margin never counts parts of unknown cost as free. */
  partsRevCosted: number;
  partsCost: number;
  hours: number;
  laborRev: number;
  byType: Record<RevenueType, number>;
}

/** The invoice as the line filters leave it. With no line filter it is the invoice exactly as stored. */
export function shapeInvoice(inv: ReportInvoice, f: ReportFilters): Shaped | null {
  let lines = inv.lines;
  const ltype = f.sets.ltype, pcat = f.sets.pcat, tax = f.sets.tax;
  if (ltype?.length) lines = lines.filter((l) => ltype.includes(l.type));
  if (pcat?.length) lines = lines.filter((l) => l.type === "Parts" && !!l.partCategory && pcat.includes(l.partCategory));
  if (tax?.length) lines = lines.filter((l) => tax.includes(l.taxable ? "Taxable" : "Not taxable"));
  if (!lines.length) return null;
  const whole = lines.length === inv.lines.length;
  const sub = whole ? inv.subtotal : r2(sum(lines, (l) => l.total));
  const taxable = r2(sum(lines.filter((l) => l.taxable), (l) => l.total));
  const taxAmount = whole ? inv.tax : inv.taxableBase > 0 ? r2((inv.tax * taxable) / inv.taxableBase) : 0;
  const byType = Object.fromEntries(REVENUE_TYPES.map((t) => [t, 0])) as Record<RevenueType, number>;
  for (const l of lines) byType[l.type] += l.total;
  const parts = lines.filter((l) => l.type === "Parts");
  const costed = parts.filter((l) => l.unitCost !== null);
  const labour = lines.filter((l) => l.type === "Labour");
  return {
    inv, lines, sub, taxable, nontax: r2(sub - taxable), tax: taxAmount, total: whole ? inv.total : r2(sub + taxAmount),
    partsRev: sum(parts, (l) => l.total), partsRevCosted: sum(costed, (l) => l.total), partsCost: sum(costed, (l) => l.qty * (l.unitCost ?? 0)),
    hours: sum(labour, (l) => l.qty), laborRev: sum(labour, (l) => l.total), byType,
  };
}

/** Applies every filter that makes sense for this report, and the line filters. */
export function shapeAll(invoices: ReportInvoice[], f: ReportFilters, report: ReportKind): Shaped[] {
  const out: Shaped[] = [];
  const active = FACETS.filter((d) => d.level === "invoice" && d.reports.includes(report) && f.sets[d.key]?.length);
  const cust = f.customer.trim().toLowerCase(), no = f.invoiceNo.trim().toLowerCase();
  for (const inv of invoices) {
    if (active.some((d) => !f.sets[d.key]!.includes(invoiceFacetValue(inv, d.key)))) continue;
    if (cust && !inv.customer.toLowerCase().includes(cust)) continue;
    if (no && !inv.number.toLowerCase().includes(no)) continue;
    const s = shapeInvoice(inv, f);
    if (!s) continue;
    if (f.min !== null && s.total < f.min) continue;
    if (f.max !== null && s.total > f.max) continue;
    out.push(s);
  }
  return out;
}

export type Basis = "invoice" | "payment";

/** The invoices that belong in a report for a date range. */
export function datasetFor(report: ReportKind, shaped: Shaped[], r: DateRange, basis: Basis = "invoice"): Shaped[] {
  return shaped.filter(({ inv }) => {
    if (report === "income") return inv.state === "Paid" && !!inv.paid && inRange(inv.paid, r.from, r.to);
    if (inv.state === "Void") return false;
    if (report === "hst" && basis === "payment") return inv.state === "Paid" && !!inv.paid && inRange(inv.paid, r.from, r.to);
    return inRange(inv.issued, r.from, r.to);
  });
}

export const stillOwed = (shaped: Shaped[]) => shaped.filter(({ inv }) => inv.state === "Unpaid" || inv.state === "Overdue");

// ---------------------------------------------------------------------------------------------
// What each report hands to the page
// ---------------------------------------------------------------------------------------------

export interface DetailCol {
  h: string;
  kind: "text" | "money" | "int" | "date" | "pct";
}
export interface DetailTable {
  cols: DetailCol[];
  rows: (string | number | null)[][];
  foot?: (string | number | null)[];
}
export interface Chart {
  periods: string[];
  labels: string[];
  series: { name: string; values: number[] }[];
}
export interface GroupRow {
  facet: FacetKey | null;
  key: string;
  label: string;
  count: number;
  a: number;
  b: number;
  c: number;
}
export interface Compare {
  value: number;
  previous: number;
}

const pctChange = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);
export const change = pctChange;

function chartFor(periods: string[], g: Group, names: string[], value: (p: string, name: string) => number): Chart {
  return { periods, labels: periods.map((p) => periodLabel(p, g)), series: names.map((name) => ({ name, values: periods.map((p) => value(p, name)) })) };
}

const groupBy = <T,>(list: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of list) { const k = key(x); const a = m.get(k); if (a) a.push(x); else m.set(k, [x]); }
  return [...m.entries()];
};

export interface IncomeReport {
  range: DateRange;
  previous: DateRange | null;
  received: Compare;
  payments: Compare;
  average: Compare;
  hst: number;
  owed: { total: number; count: number; overdueTotal: number; overdueCount: number };
  chart: Chart;
  methods: string[];
  byMethod: GroupRow[];
  byPayer: GroupRow[];
  aging: { label: string; count: number; amount: number }[];
  topCustomers: GroupRow[];
  byTech: GroupRow[];
  details: DetailTable;
}

export function buildIncome(shaped: Shaped[], range: DateRange, compare: boolean, group: Group, today: string): IncomeReport {
  const cur = datasetFor("income", shaped, range);
  const prevR = compare ? previousRange(range) : null;
  const prev = prevR ? datasetFor("income", shaped, prevR) : [];
  const rec = sum(cur, (s) => s.total), recP = sum(prev, (s) => s.total);
  const owedList = stillOwed(shaped);
  const od = owedList.filter((s) => s.inv.state === "Overdue");
  const methods = [...new Set(cur.map((s) => s.inv.method || "Not recorded"))].sort();
  const periods = periodsOf(range, group);
  const row = (facet: FacetKey | null, key: string, label: string, list: Shaped[]): GroupRow => ({ facet, key, label, count: list.length, a: sum(list, (s) => s.total), b: sum(list, (s) => s.tax), c: sum(list, (s) => s.sub) });
  const buckets: [string, number, number][] = [["Not due yet", -99999, 0], ["1 to 30 days late", 1, 30], ["31 to 60 days late", 31, 60], ["Over 60 days late", 61, 99999]];
  const rows = [...cur].sort((a, b) => (b.inv.paid ?? "").localeCompare(a.inv.paid ?? "") || b.inv.number.localeCompare(a.inv.number));
  return {
    range, previous: prevR,
    received: { value: rec, previous: recP },
    payments: { value: cur.length, previous: prev.length },
    average: { value: cur.length ? rec / cur.length : 0, previous: prev.length ? recP / prev.length : 0 },
    hst: sum(cur, (s) => s.tax),
    owed: { total: sum(owedList, (s) => s.total), count: owedList.length, overdueTotal: sum(od, (s) => s.total), overdueCount: od.length },
    chart: chartFor(periods, group, methods, (p, m) => sum(cur.filter((s) => (s.inv.method || "Not recorded") === m && periodKey(s.inv.paid!, group) === p), (s) => s.total)),
    methods,
    byMethod: groupBy(cur, (s) => s.inv.method || "Not recorded").map(([k, l]) => row("method", k, k, l)).sort((a, b) => b.a - a.a),
    byPayer: groupBy(cur, (s) => s.inv.payer).map(([k, l]) => row("payer", k, k === "Warranty" ? "Warranty providers" : "Customers", l)).sort((a, b) => b.a - a.a),
    aging: buckets.map(([label, lo, hi]) => {
      const l = owedList.filter((s) => { const d = diffDays(s.inv.due, today); return d >= lo && d <= hi; });
      return { label, count: l.length, amount: sum(l, (s) => s.total) };
    }),
    topCustomers: groupBy(cur, (s) => s.inv.customer).map(([k, l]) => row(null, k, k, l)).sort((a, b) => b.a - a.a).slice(0, 8),
    byTech: groupBy(cur, (s) => s.inv.tech).map(([k, l]) => row("tech", k, k === "Unassigned" ? "Not assigned" : k, l)).sort((a, b) => b.a - a.a),
    details: {
      cols: [{ h: "Paid", kind: "date" }, { h: "Invoice", kind: "text" }, { h: "Customer", kind: "text" }, { h: "Paid by", kind: "text" }, { h: "Reference", kind: "text" }, { h: "Who paid", kind: "text" }, { h: "Technician", kind: "text" }, { h: "Before tax", kind: "money" }, { h: "Tax", kind: "money" }, { h: "Total", kind: "money" }],
      rows: rows.map((s) => [s.inv.paid, s.inv.number, s.inv.customer, s.inv.method || "—", s.inv.reference || "—", s.inv.payer === "Warranty" ? s.inv.provider || "Warranty" : "Customer", s.inv.tech, s.sub, s.tax, s.total]),
      foot: ["Total", null, null, null, null, null, null, r2(sum(cur, (s) => s.sub)), r2(sum(cur, (s) => s.tax)), r2(rec)],
    },
  };
}

export const SALES_DIMENSIONS = [
  { key: "customer", label: "Customer", facet: null },
  { key: "etype", label: "Machine type", facet: "etype" },
  { key: "make", label: "Make", facet: "make" },
  { key: "tech", label: "Technician", facet: "tech" },
  { key: "payer", label: "Who pays", facet: "payer" },
  { key: "job", label: "Job type", facet: "job" },
  { key: "ctype", label: "New or repeat customer", facet: "ctype" },
  { key: "state", label: "Invoice status", facet: "state" },
  { key: "ltype", label: "Revenue type", facet: "ltype" },
  { key: "pcat", label: "Part category", facet: "pcat" },
] as const satisfies readonly { key: string; label: string; facet: FacetKey | null }[];
export type SalesDimension = (typeof SALES_DIMENSIONS)[number]["key"];

export interface SalesReport {
  range: DateRange;
  previous: DateRange | null;
  sales: Compare;
  invoices: Compare;
  average: Compare;
  hours: number;
  laborRev: number;
  partsRev: number;
  partsRevCosted: number;
  partsCost: number;
  warrantySales: number;
  chart: Chart;
  dimension: SalesDimension;
  summary: GroupRow[];
  topParts: { name: string; number: string; units: number; sales: number; cost: number; costedSales: number }[];
  topServices: { name: string; times: number; sales: number }[];
  details: DetailTable;
}

export function buildSales(shaped: Shaped[], range: DateRange, compare: boolean, group: Group, dimension: SalesDimension, detail: "invoice" | "line"): SalesReport {
  const cur = datasetFor("sales", shaped, range);
  const prevR = compare ? previousRange(range) : null;
  const prev = prevR ? datasetFor("sales", shaped, prevR) : [];
  const sub = sum(cur, (s) => s.sub), subP = sum(prev, (s) => s.sub);
  const periods = periodsOf(range, group);
  const taxRateOf = (s: Shaped) => (s.taxable > 0 ? s.tax / s.taxable : 0);

  let summary: GroupRow[];
  if (dimension === "ltype" || dimension === "pcat") {
    // line-level: share each invoice's tax out by its taxable lines
    const m = new Map<string, { sub: number; tax: number; invs: Set<string> }>();
    for (const s of cur) {
      const rate = taxRateOf(s);
      for (const l of s.lines) {
        const k = dimension === "ltype" ? l.type : l.type === "Parts" ? l.partCategory ?? "Uncategorized" : null;
        if (!k) continue;
        const o = m.get(k) ?? { sub: 0, tax: 0, invs: new Set<string>() };
        o.sub += l.total; if (l.taxable) o.tax += l.total * rate; o.invs.add(s.inv.id);
        m.set(k, o);
      }
    }
    const facet = dimension === "ltype" ? "ltype" : "pcat";
    summary = [...m.entries()].map(([k, o]) => ({ facet: facet as FacetKey, key: k, label: k, count: o.invs.size, a: r2(o.sub), b: r2(o.tax), c: r2(o.sub + o.tax) })).sort((x, y) => y.a - x.a);
  } else {
    const keyOf = (s: Shaped): string => {
      switch (dimension) {
        case "customer": return s.inv.customer;
        case "etype": return s.inv.machineType;
        case "make": return s.inv.make;
        case "tech": return s.inv.tech;
        case "payer": return s.inv.payer;
        case "job": return s.inv.job;
        case "ctype": return s.inv.customerType;
        default: return s.inv.state;
      }
    };
    const facet = SALES_DIMENSIONS.find((d) => d.key === dimension)!.facet as FacetKey | null;
    summary = groupBy(cur, keyOf).map(([k, l]) => ({ facet, key: k, label: k === "Unassigned" ? "Not assigned" : k, count: l.length, a: r2(sum(l, (s) => s.sub)), b: r2(sum(l, (s) => s.tax)), c: r2(sum(l, (s) => s.total)) })).sort((x, y) => y.a - x.a);
    if (dimension === "customer") summary = summary.slice(0, 15);
  }

  const parts = new Map<string, { name: string; number: string; units: number; sales: number; cost: number; costedSales: number }>();
  const services = new Map<string, { name: string; times: number; sales: number }>();
  for (const s of cur) {
    for (const l of s.lines) {
      if (l.type === "Parts") {
        const k = l.partNumber ?? l.description;
        const o = parts.get(k) ?? { name: l.description, number: l.partNumber ?? "", units: 0, sales: 0, cost: 0, costedSales: 0 };
        o.units += l.qty; o.sales += l.total;
        if (l.unitCost !== null) { o.cost += l.qty * l.unitCost; o.costedSales += l.total; }
        parts.set(k, o);
      } else if (l.type === "Services (flat price)") {
        const o = services.get(l.description) ?? { name: l.description, times: 0, sales: 0 };
        o.times += l.qty; o.sales += l.total;
        services.set(l.description, o);
      }
    }
  }

  const byInvoice = [...cur].sort((a, b) => b.inv.issued.localeCompare(a.inv.issued) || b.inv.number.localeCompare(a.inv.number));
  const details: DetailTable =
    detail === "line"
      ? {
          cols: [{ h: "Issued", kind: "date" }, { h: "Invoice", kind: "text" }, { h: "Customer", kind: "text" }, { h: "Type", kind: "text" }, { h: "Description", kind: "text" }, { h: "Part #", kind: "text" }, { h: "Qty", kind: "int" }, { h: "Unit price", kind: "money" }, { h: "Line total", kind: "money" }, { h: "Taxable", kind: "text" }],
          rows: byInvoice.flatMap((s) => s.lines.map((l) => [s.inv.issued, s.inv.number, s.inv.customer, l.type, l.description, l.partNumber ?? "", l.qty, l.unitPrice, l.total, l.taxable ? "Yes" : "No"])),
        }
      : {
          cols: [{ h: "Issued", kind: "date" }, { h: "Invoice", kind: "text" }, { h: "Customer", kind: "text" }, { h: "Machine", kind: "text" }, { h: "Technician", kind: "text" }, { h: "Payer", kind: "text" }, { h: "Labour", kind: "money" }, { h: "Parts", kind: "money" }, { h: "Services", kind: "money" }, { h: "Fees and other", kind: "money" }, { h: "Before tax", kind: "money" }, { h: "Tax", kind: "money" }, { h: "Status", kind: "text" }],
          rows: byInvoice.map((s) => [s.inv.issued, s.inv.number, s.inv.customer, [s.inv.make, s.inv.model].filter((x) => x && x !== "—").join(" ") || s.inv.machineType, s.inv.tech, s.inv.payer, r2(s.byType.Labour), r2(s.byType.Parts), r2(s.byType["Services (flat price)"]), r2(s.byType.Fees + s.byType.Other), s.sub, s.tax, s.inv.state]),
          foot: ["Total", null, null, null, null, null, r2(sum(cur, (s) => s.byType.Labour)), r2(sum(cur, (s) => s.byType.Parts)), r2(sum(cur, (s) => s.byType["Services (flat price)"])), r2(sum(cur, (s) => s.byType.Fees + s.byType.Other)), r2(sub), r2(sum(cur, (s) => s.tax)), null],
        };

  return {
    range, previous: prevR,
    sales: { value: sub, previous: subP },
    invoices: { value: cur.length, previous: prev.length },
    average: { value: cur.length ? sub / cur.length : 0, previous: prev.length ? subP / prev.length : 0 },
    hours: sum(cur, (s) => s.hours), laborRev: sum(cur, (s) => s.laborRev),
    partsRev: sum(cur, (s) => s.partsRev), partsRevCosted: sum(cur, (s) => s.partsRevCosted), partsCost: sum(cur, (s) => s.partsCost),
    warrantySales: sum(cur.filter((s) => s.inv.payer === "Warranty"), (s) => s.sub),
    chart: chartFor(periods, group, [...REVENUE_TYPES], (p, t) => sum(cur.filter((s) => periodKey(s.inv.issued, group) === p), (s) => s.byType[t as RevenueType])),
    dimension, summary,
    topParts: [...parts.values()].sort((a, b) => b.sales - a.sales).slice(0, 8),
    topServices: [...services.values()].sort((a, b) => b.sales - a.sales).slice(0, 8),
    details,
  };
}

export interface HstReport {
  range: DateRange;
  previous: DateRange | null;
  basis: Basis;
  sales: number;
  taxableSales: number;
  nonTaxableSales: number;
  collected: Compare;
  credits: number;
  net: number;
  voidedCount: number;
  voidedTax: number;
  unpaidTax: number;
  warrantyTax: number;
  linesMissingTax: number;
  chart: Chart;
  periods: { label: string; invoices: number; taxable: number; nontax: number; tax: number; total: number }[];
  byPayer: GroupRow[];
  details: DetailTable;
}

export function buildHst(shaped: Shaped[], range: DateRange, compare: boolean, group: Group, basis: Basis, creditRate: number | null, today: string): HstReport {
  void today;
  const cur = datasetFor("hst", shaped, range, basis);
  const prevR = compare ? previousRange(range) : null;
  const prev = prevR ? datasetFor("hst", shaped, prevR, basis) : [];
  const dateOf = (s: Shaped) => (basis === "payment" ? s.inv.paid! : s.inv.issued);
  const periods = periodsOf(range, group);
  const tax = sum(cur, (s) => s.tax);
  const voided = shaped.filter(({ inv }) => inv.state === "Void" && inRange(inv.issued, range.from, range.to));
  const taxable = sum(cur, (s) => s.taxable), nontax = sum(cur, (s) => s.nontax);
  const credits = creditRate === null ? 0 : r2(sum(cur, (s) => s.partsCost) * creditRate);
  const rows = [...cur].sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || b.inv.number.localeCompare(a.inv.number));
  return {
    range, previous: prevR, basis,
    sales: r2(taxable + nontax), taxableSales: r2(taxable), nonTaxableSales: r2(nontax),
    collected: { value: r2(tax), previous: r2(sum(prev, (s) => s.tax)) },
    credits, net: r2(tax - credits),
    voidedCount: voided.length, voidedTax: r2(sum(voided, (s) => s.tax)),
    unpaidTax: basis === "invoice" ? r2(sum(cur.filter((s) => s.inv.state !== "Paid"), (s) => s.tax)) : 0,
    warrantyTax: r2(sum(cur.filter((s) => s.inv.payer === "Warranty"), (s) => s.tax)),
    linesMissingTax: cur.filter((s) => s.taxable > 0 && s.tax === 0).length,
    chart: chartFor(periods, group, ["Tax collected"], (p) => sum(cur.filter((s) => periodKey(dateOf(s), group) === p), (s) => s.tax)),
    periods: periods.map((p) => {
      const l = cur.filter((s) => periodKey(dateOf(s), group) === p);
      return { label: periodLabel(p, group), invoices: l.length, taxable: r2(sum(l, (s) => s.taxable)), nontax: r2(sum(l, (s) => s.nontax)), tax: r2(sum(l, (s) => s.tax)), total: r2(sum(l, (s) => s.total)) };
    }),
    byPayer: groupBy(cur, (s) => s.inv.payer).map(([k, l]) => ({ facet: "payer" as FacetKey, key: k, label: k === "Warranty" ? "Warranty providers" : "Customers", count: l.length, a: r2(sum(l, (s) => s.sub)), b: r2(sum(l, (s) => s.tax)), c: r2(sum(l, (s) => s.total)) })),
    details: {
      cols: [{ h: basis === "payment" ? "Paid" : "Issued", kind: "date" }, { h: "Invoice", kind: "text" }, { h: "Customer", kind: "text" }, { h: "Billed to", kind: "text" }, { h: "Taxable sales", kind: "money" }, { h: "Not taxable", kind: "money" }, { h: "Tax", kind: "money" }, { h: "Total", kind: "money" }, { h: "Status", kind: "text" }],
      rows: rows.map((s) => [dateOf(s), s.inv.number, s.inv.customer, s.inv.payer === "Warranty" ? s.inv.provider || "Warranty" : "Customer", s.taxable, s.nontax, s.tax, s.total, s.inv.state]),
      foot: ["Total", null, null, null, r2(taxable), r2(nontax), r2(tax), r2(sum(cur, (s) => s.total)), null],
    },
  };
}
