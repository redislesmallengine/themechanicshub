import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeZoneForProvince } from "@/lib/provinces";
import { REPORT_PERIODS, resolveRange, type ReportPeriod } from "@/lib/report-range";
import { getSalesReport } from "@/lib/sales-report";

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Sales & Tax as a CSV file, for the accountant. Same period, same numbers as the page.
export async function GET(request: Request) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;
  if (!session || !organizationId) return new Response("Not signed in.", { status: 401 });
  const allowed = await auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { report: ["view"] } } });
  if (!allowed.success) return new Response("You don't have access to reports.", { status: 403 });

  const url = new URL(request.url);
  const periodRaw = url.searchParams.get("period") ?? "";
  const period: ReportPeriod = (REPORT_PERIODS as readonly string[]).includes(periodRaw) ? (periodRaw as ReportPeriod) : "this-month";

  const shop = await prisma.shopProfile.findUnique({ where: { organizationId }, select: { province: true, taxLabel: true } });
  const timeZone = timeZoneForProvince(shop?.province);
  const taxLabel = shop?.taxLabel || "Tax";

  const range = resolveRange(period, url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined, timeZone, Date.now());
  if ("error" in range) return new Response(range.error, { status: 400 });
  const report = await getSalesReport(organizationId, range.start, range.end, timeZone);

  const money = (n: number) => n.toFixed(2);
  const lines: (string | number)[][] = [
    ["Sales & Tax", range.label],
    [],
    ["Month", "Invoices", "Sales before tax", `${taxLabel} invoiced`, "Invoiced total", `${taxLabel} collected`, "Collected total"],
    ...report.months.map((m) => [m.month, m.invoicedCount, money(m.invoicedSales), money(m.invoicedTax), money(m.invoicedTotal), money(m.collectedTax), money(m.collectedTotal)]),
    ["Total", report.invoicedCount, money(report.invoicedSales), money(report.invoicedTax), money(report.invoicedTotal), money(report.collectedTax), money(report.collectedTotal)],
    [],
    ["How customers paid", "Payments", "Total"],
    ...report.byMethod.map((m) => [m.method, m.count, money(m.total)]),
    [],
    ["Still owed (all unpaid invoices)", report.stillOwedCount, money(report.stillOwed)],
  ];
  const csv = lines.map((row) => row.map(cell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-and-tax-${period}.csv"`,
    },
  });
}
