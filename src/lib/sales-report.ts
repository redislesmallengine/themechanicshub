import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

// Sales & Tax report: what was invoiced and what was collected over a period, with the tax on each.
//
//   Invoiced  = invoices that have gone out (sent, viewed or paid), on the day they went out
//   Collected = invoices that are paid, on the day they were paid
//
// Drafts and voided invoices are left out of both. Tax is shown both ways because which one a shop remits on
// (invoiced or collected) depends on its accountant.

export interface MonthRow {
  month: string; // "2026-10"
  invoicedCount: number;
  invoicedSales: number; // before tax
  invoicedTax: number;
  invoicedTotal: number;
  collectedTax: number;
  collectedTotal: number;
}

export interface SalesReport {
  invoicedCount: number;
  invoicedSales: number;
  invoicedTax: number;
  invoicedTotal: number;
  invoicedWarranty: number;
  collectedCount: number;
  collectedSales: number;
  collectedTax: number;
  collectedTotal: number;
  months: MonthRow[];
  byMethod: { method: string; count: number; total: number }[];
  /** Everything sent or viewed and not yet paid, whenever it was invoiced. */
  stillOwed: number;
  stillOwedCount: number;
}

const n = (v: string | number | null | undefined) => Number(v ?? 0);

export async function getSalesReport(organizationId: string, start: Date, end: Date, timeZone: string): Promise<SalesReport> {
  const issuedAt = Prisma.sql`COALESCE(i."sentAt", i."paidAt", i."createdAt")`;
  const paidAt = Prisma.sql`COALESCE(i."paidAt", i."createdAt")`;
  const localMonth = (expr: Prisma.Sql) => Prisma.sql`to_char(date_trunc('month', (${expr} AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}), 'YYYY-MM')`;

  const [issuedRows, collectedRows, methodRows, owedRows] = await Promise.all([
    prisma.$queryRaw<{ ym: string; cnt: number; subtotal: string; tax: string; total: string; warranty_total: string }[]>(Prisma.sql`
      SELECT ${localMonth(issuedAt)} AS ym, count(*)::int AS cnt,
        COALESCE(sum(i.subtotal), 0)::text AS subtotal, COALESCE(sum(i."taxAmount"), 0)::text AS tax, COALESCE(sum(i.total), 0)::text AS total,
        COALESCE(sum(i.total) FILTER (WHERE i."payerType" = 'warranty'), 0)::text AS warranty_total
      FROM "Invoice" i
      WHERE i."organizationId" = ${organizationId} AND i.status IN ('sent', 'viewed', 'paid') AND ${issuedAt} >= ${start} AND ${issuedAt} < ${end}
      GROUP BY 1 ORDER BY 1
    `),
    prisma.$queryRaw<{ ym: string; cnt: number; subtotal: string; tax: string; total: string }[]>(Prisma.sql`
      SELECT ${localMonth(paidAt)} AS ym, count(*)::int AS cnt,
        COALESCE(sum(i.subtotal), 0)::text AS subtotal, COALESCE(sum(i."taxAmount"), 0)::text AS tax, COALESCE(sum(i.total), 0)::text AS total
      FROM "Invoice" i
      WHERE i."organizationId" = ${organizationId} AND i.status = 'paid' AND ${paidAt} >= ${start} AND ${paidAt} < ${end}
      GROUP BY 1 ORDER BY 1
    `),
    prisma.$queryRaw<{ method: string | null; cnt: number; total: string }[]>(Prisma.sql`
      SELECT i."paymentMethod" AS method, count(*)::int AS cnt, COALESCE(sum(i.total), 0)::text AS total
      FROM "Invoice" i
      WHERE i."organizationId" = ${organizationId} AND i.status = 'paid' AND ${paidAt} >= ${start} AND ${paidAt} < ${end}
      GROUP BY 1 ORDER BY sum(i.total) DESC
    `),
    prisma.$queryRaw<{ total: string; cnt: number }[]>(Prisma.sql`
      SELECT COALESCE(sum(i.total), 0)::text AS total, count(*)::int AS cnt
      FROM "Invoice" i
      WHERE i."organizationId" = ${organizationId} AND i.status IN ('sent', 'viewed')
    `),
  ]);

  const months = new Map<string, MonthRow>();
  const row = (ym: string): MonthRow => {
    let r = months.get(ym);
    if (!r) {
      r = { month: ym, invoicedCount: 0, invoicedSales: 0, invoicedTax: 0, invoicedTotal: 0, collectedTax: 0, collectedTotal: 0 };
      months.set(ym, r);
    }
    return r;
  };
  for (const r of issuedRows) Object.assign(row(r.ym), { invoicedCount: r.cnt, invoicedSales: n(r.subtotal), invoicedTax: n(r.tax), invoicedTotal: n(r.total) });
  for (const r of collectedRows) Object.assign(row(r.ym), { collectedTax: n(r.tax), collectedTotal: n(r.total) });

  const sum = <T,>(rows: T[], pick: (r: T) => number) => rows.reduce((total, r) => total + pick(r), 0);
  return {
    invoicedCount: sum(issuedRows, (r) => r.cnt),
    invoicedSales: sum(issuedRows, (r) => n(r.subtotal)),
    invoicedTax: sum(issuedRows, (r) => n(r.tax)),
    invoicedTotal: sum(issuedRows, (r) => n(r.total)),
    invoicedWarranty: sum(issuedRows, (r) => n(r.warranty_total)),
    collectedCount: sum(collectedRows, (r) => r.cnt),
    collectedSales: sum(collectedRows, (r) => n(r.subtotal)),
    collectedTax: sum(collectedRows, (r) => n(r.tax)),
    collectedTotal: sum(collectedRows, (r) => n(r.total)),
    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    byMethod: methodRows.map((r) => ({ method: r.method ?? "Not recorded", count: r.cnt, total: n(r.total) })),
    stillOwed: n(owedRows[0]?.total),
    stillOwedCount: owedRows[0]?.cnt ?? 0,
  };
}
