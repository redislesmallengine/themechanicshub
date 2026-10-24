import { prisma } from "@/lib/prisma";
import { timeZoneForProvince } from "@/lib/provinces";
import { now as getNow } from "@/lib/work-orders";
import { loadReportInvoices } from "@/lib/report-data";
import { buildHst, buildIncome, buildSales, facetOptions, FACETS, previousRange, resolvePreset, shapeAll, toLocalDate, type DateRange, type FacetKey, type HstReport, type IncomeReport, type ReportKind, type SalesReport } from "@/lib/report-engine";
import type { ReportParams } from "@/lib/report-params";

export interface ReportContext {
  range: DateRange;
  today: string;
  taxLabel: string;
  taxRate: number;
  options: Record<FacetKey, string[]>;
  draftCount: number;
  canViewMargins: boolean;
  /** How many invoices matched the filters at all, before the date range. */
  loaded: number;
}

async function prepare(organizationId: string, report: ReportKind, p: ReportParams, canViewMargins: boolean) {
  const shop = await prisma.shopProfile.findUnique({ where: { organizationId }, select: { province: true, taxLabel: true, taxRate: true } });
  const timeZone = timeZoneForProvince(shop?.province);
  const today = toLocalDate(new Date(getNow()), timeZone);
  let range = resolvePreset(p.preset, p.from, p.to, today);
  // "Everything" starts where the shop's data starts, not in the year 2000 (which made the daily view scroll for ever).
  if (p.preset === "all") {
    const first = await prisma.invoice.aggregate({ where: { organizationId }, _min: { issueDate: true, paidAt: true } });
    const dates = [first._min.issueDate, first._min.paidAt].filter((d): d is Date => !!d).map((d) => toLocalDate(d, timeZone));
    if (dates.length > 0) range = { from: dates.reduce((a, b) => (a < b ? a : b)), to: today };
  }
  const taxRate = shop?.taxRate ? Number(shop.taxRate) : 0;

  const { invoices, draftCount } = await loadReportInvoices({ organizationId, timeZone, from: p.compare ? previousRange(range).from : range.from, to: range.to, today, canViewMargins });
  const options = facetOptions(invoices);
  // keep a chosen value on screen even when nothing in this window carries it
  for (const d of FACETS) for (const v of p.filters.sets[d.key] ?? []) if (!options[d.key].includes(v)) options[d.key] = [...options[d.key], v];
  const shaped = shapeAll(invoices, p.filters, report);
  const context: ReportContext = { range, today, taxLabel: shop?.taxLabel || "Tax", taxRate, options, draftCount, canViewMargins, loaded: shaped.length };
  return { context, shaped };
}

export async function runIncome(organizationId: string, p: ReportParams, canViewMargins: boolean): Promise<{ context: ReportContext; data: IncomeReport }> {
  const { context, shaped } = await prepare(organizationId, "income", p, canViewMargins);
  return { context, data: buildIncome(shaped, context.range, p.compare, p.group, context.today) };
}

export async function runSales(organizationId: string, p: ReportParams, canViewMargins: boolean): Promise<{ context: ReportContext; data: SalesReport }> {
  const { context, shaped } = await prepare(organizationId, "sales", p, canViewMargins);
  return { context, data: buildSales(shaped, context.range, p.compare, p.group, p.dim, p.detail) };
}

export async function runHst(organizationId: string, p: ReportParams, canViewMargins: boolean): Promise<{ context: ReportContext; data: HstReport }> {
  const { context, shaped } = await prepare(organizationId, "hst", p, canViewMargins);
  // Input tax credits are estimated from the cost of parts sold, so they need cost prices the viewer may see.
  const creditRate = p.itc && canViewMargins && context.taxRate > 0 ? context.taxRate / 100 : null;
  return { context, data: buildHst(shaped, context.range, p.compare, p.group, p.basis, creditRate, context.today) };
}
