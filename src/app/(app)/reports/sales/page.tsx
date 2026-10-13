import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeZoneForProvince } from "@/lib/provinces";
import { now as getNow } from "@/lib/work-orders";
import { REPORT_PERIODS, REPORT_PERIOD_LABELS, resolveRange, type ReportPeriod } from "@/lib/report-range";
import { getSalesReport } from "@/lib/sales-report";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ReportIcon } from "@/components/icons";

const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
};

export default async function SalesAndTaxPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const { period: periodRaw, from, to } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;
  if (!session || !organizationId) redirect("/sign-in");

  const allowed = await auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { report: ["view"] } } });
  if (!allowed.success) redirect("/dashboard");

  const shop = await prisma.shopProfile.findUnique({ where: { organizationId }, select: { province: true, taxLabel: true } });
  const timeZone = timeZoneForProvince(shop?.province);
  const taxLabel = shop?.taxLabel || "Tax";

  const period: ReportPeriod = (REPORT_PERIODS as readonly string[]).includes(periodRaw ?? "") ? (periodRaw as ReportPeriod) : "this-month";
  const range = resolveRange(period, from, to, timeZone, getNow());
  const report = "error" in range ? null : await getSalesReport(organizationId, range.start, range.end, timeZone);

  const csvHref = `/reports/sales/csv?period=${period}${period === "custom" && from && to ? `&from=${from}&to=${to}` : ""}`;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <ReportIcon className="w-5 h-5 text-orange-400" />
            Sales &amp; Tax
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            What was invoiced and what was collected, with the {taxLabel.toLowerCase()} on each. Drafts and voided invoices are not counted.
          </p>
        </div>
        {report && (
          <a href={csvHref} className="px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}>
            Download CSV
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {REPORT_PERIODS.filter((p) => p !== "custom").map((p) => {
          const on = p === period;
          return (
            <Link
              key={p}
              href={`/reports/sales?period=${p}`}
              aria-current={on ? "true" : undefined}
              className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: on ? "var(--color-brand-600)" : "var(--bg-surface)", color: on ? "#fff" : "var(--text-secondary)", border: `1px solid ${on ? "var(--color-brand-600)" : "var(--border-strong)"}` }}
            >
              {REPORT_PERIOD_LABELS[p]}
            </Link>
          );
        })}
        <form method="GET" className="flex items-center gap-2 ml-1">
          <input type="hidden" name="period" value="custom" />
          <label htmlFor="from" className="sr-only">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={from ?? ""} required className="px-2 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            to
          </span>
          <label htmlFor="to" className="sr-only">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={to ?? ""} required className="px-2 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }} />
          <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-bold" style={period === "custom" ? { background: "var(--color-brand-600)", color: "#fff" } : { background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}>
            Custom range
          </button>
        </form>
      </div>

      {"error" in range && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {range.error}
        </p>
      )}

      {report && !("error" in range) && (
        <>
          <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            {range.label} · {range.start.toLocaleDateString("en-CA", { timeZone, dateStyle: "medium" })} to {new Date(range.end.getTime() - 1).toLocaleDateString("en-CA", { timeZone, dateStyle: "medium" })}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Sales before tax" value={money(report.invoicedSales)} sub={`${report.invoicedCount} invoice${report.invoicedCount === 1 ? "" : "s"} sent or paid`} />
            <StatTile label={`${taxLabel} invoiced`} value={money(report.invoicedTax)} sub="on invoices that went out" />
            <StatTile label={`${taxLabel} collected`} value={money(report.collectedTax)} sub={`on ${report.collectedCount} payment${report.collectedCount === 1 ? "" : "s"} received`} tone="success" />
            <StatTile label="Still owed" value={money(report.stillOwed)} sub={`${report.stillOwedCount} unpaid invoice${report.stillOwedCount === 1 ? "" : "s"}, all time`} href="/invoices?status=unpaid" tone={report.stillOwed > 0 ? "warning" : "neutral"} />
          </div>

          <div className="dt-container">
            <div className="dt-scroll">
              <table className="dt-table">
                <thead className="dt-head">
                  <tr>
                    <th className="dt-th text-left">Month</th>
                    <th className="dt-th text-right">Invoices</th>
                    <th className="dt-th text-right">Sales before tax</th>
                    <th className="dt-th text-right">{taxLabel} invoiced</th>
                    <th className="dt-th text-right">Invoiced total</th>
                    <th className="dt-th text-right">{taxLabel} collected</th>
                    <th className="dt-th text-right">Collected total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.months.length === 0 && (
                    <tr>
                      <td colSpan={7} className="dt-td text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                        Nothing was invoiced or collected in this period.
                      </td>
                    </tr>
                  )}
                  {report.months.map((m) => (
                    <tr key={m.month} className="dt-row">
                      <td className="dt-td text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {monthLabel(m.month)}
                      </td>
                      <td className="dt-td num text-sm text-right">{m.invoicedCount}</td>
                      <td className="dt-td num text-sm text-right">{money(m.invoicedSales)}</td>
                      <td className="dt-td num text-sm text-right">{money(m.invoicedTax)}</td>
                      <td className="dt-td num text-sm text-right">{money(m.invoicedTotal)}</td>
                      <td className="dt-td num text-sm text-right">{money(m.collectedTax)}</td>
                      <td className="dt-td num text-sm text-right">{money(m.collectedTotal)}</td>
                    </tr>
                  ))}
                  {report.months.length > 1 && (
                    <tr className="dt-row" style={{ fontWeight: 800 }}>
                      <td className="dt-td text-sm">Total</td>
                      <td className="dt-td num text-sm text-right">{report.invoicedCount}</td>
                      <td className="dt-td num text-sm text-right">{money(report.invoicedSales)}</td>
                      <td className="dt-td num text-sm text-right">{money(report.invoicedTax)}</td>
                      <td className="dt-td num text-sm text-right">{money(report.invoicedTotal)}</td>
                      <td className="dt-td num text-sm text-right">{money(report.collectedTax)}</td>
                      <td className="dt-td num text-sm text-right">{money(report.collectedTotal)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                How customers paid
              </h2>
              {report.byMethod.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  No payments in this period.
                </p>
              ) : (
                <div className="space-y-2">
                  {report.byMethod.map((m) => (
                    <div key={m.method} className="flex justify-between text-sm">
                      <span style={{ color: "var(--text-secondary)" }}>
                        {m.method} <span style={{ color: "var(--text-muted)" }}>· {m.count}</span>
                      </span>
                      <span className="num font-semibold" style={{ color: "var(--text-primary)" }}>
                        {money(m.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl p-5 text-xs space-y-2" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
              <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                How to read this
              </h2>
              <p>
                <b>Invoiced</b> counts an invoice on the day it was sent (or paid, if it was never sent). <b>Collected</b> counts it on the day it was paid. Which one your {taxLabel.toLowerCase()} return uses depends on your accountant, so both are shown.
              </p>
              {report.invoicedWarranty > 0 && <p>Warranty claims are included in the invoiced figures: {money(report.invoicedWarranty)} in this period.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
