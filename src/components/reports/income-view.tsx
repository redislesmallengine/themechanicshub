import { change, type GroupRow, type IncomeReport } from "@/lib/report-engine";
import { onlyFacet, toQuery, type ReportParams } from "@/lib/report-params";
import type { ReportContext } from "@/lib/report-run";
import { ReportFrame } from "@/components/reports/report-frame";
import { Card, DetailTableView, Empty, fmtMoney, GroupTable, Kpi, KpiRow, Legend, Share, StackedChart } from "@/components/reports/report-ui";
const LIMIT = 25;

export function IncomeView({ p, context, d }: { p: ReportParams; context: ReportContext; d: IncomeReport }) {
  const path = "/reports/income";
  const cmp = (cur: number, prev: number) => (p.compare ? change(cur, prev) : null);
  const hrefFor = (r: GroupRow) => (r.facet ? `${path}${onlyFacet(p, r.facet, r.key)}` : `${path}${toQuery(p, { cust: r.key, all: null })}`);
  const rec = d.received.value;
  const total = (rows: GroupRow[]) => rows.reduce((t, r) => t + r.a, 0);
  const columns = [
    { h: "Payments", value: (r: GroupRow) => r.count },
    { h: "Amount", value: (r: GroupRow) => fmtMoney(r.a) },
    { h: "Share", value: (r: GroupRow) => <Share value={r.a} total={rec} /> },
  ];

  return (
    <ReportFrame report="income" p={p} context={context}>
      <KpiRow>
        <Kpi label="Money received" value={fmtMoney(rec)} sub={`${d.payments.value} payment${d.payments.value === 1 ? "" : "s"}`} change={cmp(rec, d.received.previous)} />
        <Kpi label="Average payment" value={fmtMoney(d.average.value)} change={cmp(d.average.value, d.average.previous)} />
        <Kpi label={`${context.taxLabel} in that money`} value={fmtMoney(d.hst)} sub={`of ${fmtMoney(rec)}`} />
        <Kpi label="Still owed to you" value={fmtMoney(d.owed.total)} sub={`${d.owed.count} invoice${d.owed.count === 1 ? "" : "s"}, any date`} goodUp={false} />
        <Kpi label="Overdue" value={fmtMoney(d.owed.overdueTotal)} sub={`${d.owed.overdueCount} invoice${d.owed.overdueCount === 1 ? "" : "s"}`} goodUp={false} />
      </KpiRow>

      <Card title="Money received over time" sub={`each ${p.group}, by how it was paid`}>
        {d.payments.value === 0 ? (
          <Empty>No payments were received in this period.</Empty>
        ) : (
          <>
            <Legend names={d.methods} />
            <StackedChart chart={d.chart} label="Money received over time by payment method" />
          </>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="How it was paid" sub="click a row to show only that">
          <GroupTable head="Paid by" rows={d.byMethod} hrefFor={hrefFor} columns={columns} />
        </Card>
        <Card title="Who paid">
          <GroupTable head="Paid by" rows={d.byPayer} hrefFor={hrefFor} columns={columns} />
        </Card>
        <Card title="Money still owed" sub="right now, all dates">
          {d.owed.count === 0 ? (
            <Empty>Nothing is owed. Every invoice is paid.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-strong)" }}>
                    <th className="text-left px-2.5 py-1.5">How late</th>
                    <th className="text-right px-2.5 py-1.5">Invoices</th>
                    <th className="text-right px-2.5 py-1.5">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.aging.map((a) => (
                    <tr key={a.label} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td className="px-2.5 py-1.5 font-semibold">{a.label}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono">{a.count}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border-strong)" }} className="font-extrabold">
                    <td className="px-2.5 py-1.5">Total</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">{d.owed.count}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(d.owed.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
        <Card title="Top customers" sub="by money paid">
          <GroupTable head="Customer" rows={d.topCustomers} hrefFor={hrefFor} columns={columns.slice(0, 2)} />
        </Card>
      </div>

      <Card title="By technician">
        <GroupTable head="Technician" rows={d.byTech} hrefFor={hrefFor} columns={columns} />
      </Card>

      <Card title="Every payment" sub={`newest first, ${d.details.rows.length} payment${d.details.rows.length === 1 ? "" : "s"}; ${fmtMoney(total(d.byMethod))} in total`}>
        <DetailTableView table={d.details} limit={LIMIT} shown={p.all} moreHref={`${path}${toQuery(p, { all: "1" })}`} lessHref={`${path}${toQuery(p, { all: null })}`} />
      </Card>
    </ReportFrame>
  );
}
