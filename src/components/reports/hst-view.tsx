import Link from "next/link";
import { change, type DetailTable, type GroupRow, type HstReport } from "@/lib/report-engine";
import { onlyFacet, toQuery, type ReportParams } from "@/lib/report-params";
import type { ReportContext } from "@/lib/report-run";
import { ReportFrame } from "@/components/reports/report-frame";
import { Card, DetailTableView, Empty, fmtMoney, GroupTable, Kpi, KpiRow, Seg, StackedChart } from "@/components/reports/report-ui";
const LIMIT = 25;

function ReturnLine({ line, label, value, sub, strong }: { line?: string; label: string; value: string; sub?: boolean; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-3 px-3 py-2 items-baseline" style={{ borderTop: "1px solid var(--border-subtle)", background: strong ? "var(--color-info-subtle)" : undefined }}>
      <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
        {line}
      </span>
      <span className={sub ? "pl-6 text-xs" : "text-xs font-semibold"} style={{ color: sub ? "var(--text-secondary)" : "var(--text-primary)" }}>
        {label}
      </span>
      <span className={`text-xs font-mono tabular-nums ${sub ? "" : "font-bold"}`} style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

function Check({ tone, text }: { tone: "ok" | "note" | "info"; text: string }) {
  const style = tone === "ok" ? { color: "var(--color-success-solid)", background: "var(--color-success-subtle)" } : tone === "note" ? { color: "var(--color-warning-solid)", background: "var(--color-warning-subtle)" } : { color: "var(--text-muted)", background: "var(--bg-surface-subtle)" };
  return (
    <div className="flex gap-2 items-baseline text-xs" style={{ color: "var(--text-secondary)" }}>
      <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={style}>
        {tone === "ok" ? "OK" : tone === "note" ? "Note" : "Info"}
      </span>
      <span>{text}</span>
    </div>
  );
}

export function HstView({ p, context, d, canViewMargins }: { p: ReportParams; context: ReportContext; d: HstReport; canViewMargins: boolean }) {
  const label = context.taxLabel;
  const path = "/reports/hst";
  const q = (c: Record<string, string | null> = {}) => `${path}${toQuery(p, { all: null, ...c })}`;
  const hrefFor = (r: GroupRow) => (r.facet ? `${path}${onlyFacet(p, r.facet, r.key)}` : null);
  const creditsOn = p.itc && canViewMargins && context.taxRate > 0;
  const rate = context.taxRate > 0 ? `${context.taxRate}%` : "tax";
  const periods: DetailTable = {
    cols: [{ h: "Period", kind: "text" }, { h: "Invoices", kind: "int" }, { h: "Taxable sales", kind: "money" }, { h: "Not taxable", kind: "money" }, { h: label, kind: "money" }, { h: "Total", kind: "money" }],
    rows: d.periods.map((x) => [x.label, x.invoices, x.taxable, x.nontax, x.tax, x.total]),
    foot: ["Total", d.periods.reduce((t, x) => t + x.invoices, 0), d.taxableSales, d.nonTaxableSales, d.collected.value, d.periods.reduce((t, x) => t + x.total, 0)],
  };
  const cmp = p.compare ? change(d.collected.value, d.collected.previous) : null;

  return (
    <ReportFrame report="hst" p={p} context={context}>
      <div className="rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 print:hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
          <span>File on</span>
          <Seg items={[{ label: "Invoice date", href: q({ basis: null }), on: p.basis === "invoice" }, { label: "Payment date", href: q({ basis: "payment" }), on: p.basis === "payment" }]} />
          {canViewMargins && context.taxRate > 0 && (
            <Link href={q({ itc: p.itc ? "0" : null })} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 rounded border text-[10px] leading-3 text-center" style={p.itc ? { background: "var(--color-brand-600)", borderColor: "var(--color-brand-600)", color: "#fff" } : { borderColor: "var(--border-strong)" }}>
                {p.itc ? "✓" : ""}
              </span>
              Include estimated credits on parts
            </Link>
          )}
        </div>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {p.basis === "invoice" ? "Tax counts on the day each invoice went out." : "Tax counts on the day each invoice was paid."}
        </span>
      </div>

      <KpiRow>
        <Kpi label={`${label} collected`} value={fmtMoney(d.collected.value)} sub={p.basis === "invoice" ? "on invoices issued" : "on payments received"} change={cmp} />
        <Kpi label="Taxable sales" value={fmtMoney(d.taxableSales)} sub={`at ${rate}`} />
        <Kpi label="Not taxable" value={fmtMoney(d.nonTaxableSales)} sub={`no ${label} charged`} />
        {creditsOn && <Kpi label="Estimated credits" value={fmtMoney(d.credits)} sub="on parts you sold" />}
        <Kpi label={`Net ${label} to remit`} value={fmtMoney(d.net)} sub={creditsOn ? "collected minus credits" : "no credits counted"} goodUp={false} />
      </KpiRow>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Return summary" sub={p.basis === "invoice" ? "invoice basis" : "payment basis"}>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
            <div style={{ marginTop: -1 }}>
              <ReturnLine line="Line 101" label="Sales and other revenue (before tax)" value={fmtMoney(d.sales)} />
              <ReturnLine label={`Taxable at ${rate}`} value={fmtMoney(d.taxableSales)} sub />
              <ReturnLine label="Not taxable" value={fmtMoney(d.nonTaxableSales)} sub />
              <ReturnLine line="Line 103" label={`${label} collected or collectible`} value={fmtMoney(d.collected.value)} />
              <ReturnLine line="Line 106" label={`Input tax credits${creditsOn ? " (estimate)" : ""}`} value={creditsOn ? fmtMoney(d.credits) : "not estimated"} />
              <ReturnLine line="Line 109" label="Net tax to remit or (refund)" value={fmtMoney(d.net)} strong />
            </div>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Laid out like the lines on the federal GST/HST return so your accountant can follow it. {creditsOn ? `Credits are an estimate: ${context.taxRate}% of what the parts you sold cost you, which is not the same as the ${label} on your supplier bills. ` : ""}Confirm the figures with your accountant before filing.
          </p>
        </Card>

        <Card title="Checks">
          <div className="space-y-2">
            <Check tone={d.linesMissingTax ? "note" : "ok"} text={`${d.linesMissingTax} invoice${d.linesMissingTax === 1 ? " has" : "s have"} taxable lines but no ${label}.`} />
            <Check tone={d.voidedCount ? "note" : "ok"} text={`${d.voidedCount} voided invoice${d.voidedCount === 1 ? "" : "s"} in this period, ${fmtMoney(d.voidedTax)} of ${label} left out.`} />
            {p.basis === "invoice" ? (
              <Check tone={d.unpaidTax > 0 ? "note" : "ok"} text={`${fmtMoney(d.unpaidTax)} of the ${label} above is on invoices not paid yet. On the invoice basis you owe it even before it is collected.`} />
            ) : (
              <Check tone="info" text={`On the payment basis ${label} counts only once an invoice is paid, so unpaid invoices are not in these figures.`} />
            )}
            <Check tone="info" text={`${fmtMoney(d.warrantyTax)} of the ${label} is on warranty claims billed to makers.`} />
            <Check tone="info" text={`${context.draftCount} draft invoice${context.draftCount === 1 ? " is" : "s are"} not counted because they have not gone out yet.`} />
            <Check tone="info" text={`The ${label} on each invoice is the amount stored when it was made. Part of an invoice shown through a revenue or part filter gets a share of it by taxable lines.`} />
          </div>
        </Card>
      </div>

      <Card title={`${label} collected over time`} sub={`each ${p.group}`}>
        {d.collected.value === 0 ? <Empty>No {label} in this period.</Empty> : <StackedChart chart={d.chart} label={`${label} collected over time`} />}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="By period">
          <DetailTableView table={periods} limit={400} shown moreHref="" lessHref="" />
        </Card>
        <Card title="Billed to" sub="click a row to show only that">
          <GroupTable
            head="Billed to"
            rows={d.byPayer}
            hrefFor={hrefFor}
            columns={[{ h: "Invoices", value: (r) => r.count }, { h: "Sales", value: (r) => fmtMoney(r.a) }, { h: label, value: (r) => fmtMoney(r.b) }]}
          />
        </Card>
      </div>

      <Card title="Every invoice in the return" sub={`dated by ${p.basis === "payment" ? "payment" : "invoice"} date`}>
        <DetailTableView table={d.details} limit={LIMIT} shown={p.all} moreHref={q({ all: "1" })} lessHref={q({ all: null })} />
      </Card>
    </ReportFrame>
  );
}
