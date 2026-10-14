import Link from "next/link";
import { change, REVENUE_TYPES, SALES_DIMENSIONS, type DetailTable, type GroupRow, type SalesReport } from "@/lib/report-engine";
import { onlyFacet, toQuery, type ReportParams } from "@/lib/report-params";
import type { ReportContext } from "@/lib/report-run";
import { ReportFrame } from "@/components/reports/report-frame";
import { Card, DetailTableView, Empty, fmtMoney, GroupTable, Kpi, KpiRow, Legend, Seg, Share, StackedChart } from "@/components/reports/report-ui";
const LIMIT = 25;

export function SalesView({ p, context, d, canViewMargins }: { p: ReportParams; context: ReportContext; d: SalesReport; canViewMargins: boolean }) {
  const path = "/reports/sales";
  const q = (c: Record<string, string | null> = {}) => `${path}${toQuery(p, { all: null, ...c })}`;
  const cmp = (cur: number, prev: number) => (p.compare ? change(cur, prev) : null);
  const margin = d.partsRevCosted > 0 ? (d.partsRevCosted - d.partsCost) / d.partsRevCosted : null;
  const hrefFor = (r: GroupRow) => (r.facet ? `${path}${onlyFacet(p, r.facet, r.key)}` : `${path}${toQuery(p, { cust: r.key, all: null })}`);
  const totalSales = d.sales.value;

  const partsTable: DetailTable = {
    cols: [{ h: "Part", kind: "text" }, { h: "Part #", kind: "text" }, { h: "Units", kind: "int" }, { h: "Sales", kind: "money" }, ...(canViewMargins ? [{ h: "Margin", kind: "pct" as const }] : [])],
    rows: d.topParts.map((x) => [x.name, x.number || "—", x.units, x.sales, ...(canViewMargins ? [x.costedSales > 0 ? (x.costedSales - x.cost) / x.costedSales : null] : [])]),
  };
  const servicesTable: DetailTable = { cols: [{ h: "Flat-price service", kind: "text" }, { h: "Times sold", kind: "int" }, { h: "Sales", kind: "money" }], rows: d.topServices.map((x) => [x.name, x.times, x.sales]) };

  const sumTotals = {
    count: d.summary.reduce((t, r) => t + r.count, 0), a: d.summary.reduce((t, r) => t + r.a, 0), b: d.summary.reduce((t, r) => t + r.b, 0), c: d.summary.reduce((t, r) => t + r.c, 0),
  };

  return (
    <ReportFrame report="sales" p={p} context={context}>
      <KpiRow>
        <Kpi label="Sales before tax" value={fmtMoney(totalSales)} sub={`${d.invoices.value} invoice${d.invoices.value === 1 ? "" : "s"}`} change={cmp(totalSales, d.sales.previous)} />
        <Kpi label="Average invoice" value={fmtMoney(d.average.value)} sub="before tax" change={cmp(d.average.value, d.average.previous)} />
        <Kpi label="Labour billed by the hour" value={`${d.hours.toFixed(1)} hrs`} sub={d.hours > 0 ? `${fmtMoney(d.laborRev / d.hours)} per hour` : "no hourly labour"} />
        {canViewMargins && <Kpi label="Gross margin on parts" value={margin === null ? "n/a" : `${(margin * 100).toFixed(0)}%`} sub={margin === null ? "no parts with a cost" : `${fmtMoney(d.partsRevCosted - d.partsCost)} on ${fmtMoney(d.partsRevCosted)}`} />}
        <Kpi label="Billed to makers" value={totalSales > 0 ? `${((d.warrantySales / totalSales) * 100).toFixed(0)}%` : "0%"} sub={`${fmtMoney(d.warrantySales)} warranty`} />
      </KpiRow>

      <Card title="Sales over time" sub={`before tax, each ${p.group}, by type of work`}>
        {d.invoices.value === 0 ? (
          <Empty>No invoices went out in this period.</Empty>
        ) : (
          <>
            <Legend names={[...REVENUE_TYPES]} />
            <StackedChart chart={d.chart} label="Sales over time by type of work" />
          </>
        )}
      </Card>

      <Card title="Summary" sub="group the same sales different ways; click a row to show only that">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Group the summary by">
          {SALES_DIMENSIONS.map((x) => (
            <Link
              key={x.key}
              href={q({ dim: x.key === "customer" ? null : x.key })}
              aria-pressed={d.dimension === x.key}
              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
              style={d.dimension === x.key ? { background: "var(--color-brand-600)", color: "#fff", border: "1px solid var(--color-brand-600)" } : { background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-strong)" }}
            >
              {x.label}
            </Link>
          ))}
        </div>
        <GroupTable
          head="Group"
          rows={d.summary}
          hrefFor={hrefFor}
          columns={[
            { h: "Invoices", value: (r) => r.count },
            { h: "Sales", value: (r) => fmtMoney(r.a) },
            { h: context.taxLabel, value: (r) => fmtMoney(r.b) },
            { h: "Total", value: (r) => fmtMoney(r.c) },
            { h: "Share of sales", value: (r) => <Share value={r.a} total={totalSales} /> },
          ]}
          foot={
            d.summary.length > 1 && d.dimension !== "customer" ? (
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border-strong)" }} className="font-extrabold text-xs">
                  <td className="px-2.5 py-1.5">Total</td>
                  <td className="px-2.5 py-1.5 text-right font-mono">{sumTotals.count}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(sumTotals.a)}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(sumTotals.b)}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(sumTotals.c)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : undefined
          }
        />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Best-selling parts" sub={canViewMargins ? "by sales, with margin" : "by sales"}>
          <DetailTableView table={partsTable} limit={8} shown moreHref="" lessHref="" />
        </Card>
        <Card title="Flat-price services" sub="by sales">
          <DetailTableView table={servicesTable} limit={8} shown moreHref="" lessHref="" />
        </Card>
      </div>

      <Card
        title={p.detail === "line" ? "Every invoice line" : "Every invoice"}
        sub={`${d.details.rows.length} ${p.detail === "line" ? "line" : "invoice"}${d.details.rows.length === 1 ? "" : "s"}${p.detail === "line" ? "" : ", newest first"}`}
      >
        <Seg items={[{ label: "By invoice", href: q({ detail: null }), on: p.detail === "invoice" }, { label: "By line", href: q({ detail: "line" }), on: p.detail === "line" }]} />
        <DetailTableView table={d.details} limit={LIMIT} shown={p.all} moreHref={q({ all: "1" })} lessHref={q({ all: null })} />
      </Card>
    </ReportFrame>
  );
}
