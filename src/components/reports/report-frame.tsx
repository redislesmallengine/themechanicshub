import Link from "next/link";
import { FACETS, longDate, previousRange, shortDate, type ReportKind } from "@/lib/report-engine";
import { toggleFacet, toQuery, type ReportParams } from "@/lib/report-params";
import type { ReportContext } from "@/lib/report-run";
import { ReportIcon } from "@/components/icons";
import { DateRangeForm, FilterDetails, PrintButton } from "@/components/reports/report-client";
import { Seg } from "@/components/reports/report-ui";

const TABS: { report: ReportKind; label: string; blurb: string }[] = [
  { report: "income", label: "Income", blurb: "Money that came in, by the day it was paid" },
  { report: "sales", label: "Sales", blurb: "Work you billed, by the day it was invoiced" },
  { report: "hst", label: "HST", blurb: "Tax collected, laid out like your return" },
];
const EXPLAIN: Record<ReportKind, string> = {
  income: "Income counts money that actually came in. An invoice counts on the day it was paid, in full. Unpaid invoices are not income yet; they show as money still owed.",
  sales: "Sales counts work you billed, on the day the invoice went out, before tax. It does not matter whether the customer has paid yet. Voided invoices and drafts are left out.",
  hst: "This shows the tax on those sales, laid out like the lines on a GST/HST return. Choose whether to file on the invoice date or on the payment date, and confirm the figures with your accountant before filing.",
};
const TITLES: Record<ReportKind, string> = { income: "Income Report", sales: "Sales Report", hst: "HST Report" };

const field = "mt-1 w-full px-2.5 py-1.5 rounded-lg text-xs";
const inputStyle = { background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" };
const sectionStyle = { borderTop: "1px solid var(--border-subtle)" };

function FilterBody({ report, p, context }: { report: ReportKind; p: ReportParams; context: ReportContext }) {
  const path = `/reports/${report}`;
  const here = (change: Record<string, string | null> = {}) => `${path}${toQuery(p, change)}`;
  const facets = FACETS.filter((d) => d.reports.includes(report));
  const groups: { title: string; keys: string[] }[] = [
    { title: "Customer", keys: ["ctype"] },
    { title: "Machine", keys: ["etype", "make"] },
    { title: "Work", keys: ["tech", "job", "arrival"] },
    { title: "Money", keys: ["payer", "provider", "method", "state"] },
    { title: "What was billed", keys: ["ltype", "pcat", "tax"] },
  ];
  const hidden = new URLSearchParams(toQuery(p, { cust: null, inv: null, min: null, max: null, all: null }));
  return (
    <div>
      <div className="px-4 pb-3 space-y-2">
        <DateRangeForm basePath={path} baseQuery={toQuery(p, { preset: null, from: null, to: null, all: null })} preset={p.preset} from={p.from || context.range.from} to={p.to || context.range.to} />
      </div>
      <form action={path} method="get" className="px-4 py-3 space-y-2" style={sectionStyle}>
        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Find
        </div>
        {[...hidden.entries()].map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label className="block text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
          Customer name contains
          <input name="cust" defaultValue={p.filters.customer} className={field} style={inputStyle} placeholder="Type a name" />
        </label>
        <label className="block text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
          Invoice number
          <input name="inv" defaultValue={p.filters.invoiceNo} className={field} style={inputStyle} placeholder="INV-1040" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
            Invoice from ($)
            <input name="min" type="number" step="0.01" defaultValue={p.filters.min ?? ""} className={field} style={inputStyle} placeholder="0" />
          </label>
          <label className="block text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
            up to ($)
            <input name="max" type="number" step="0.01" defaultValue={p.filters.max ?? ""} className={field} style={inputStyle} placeholder="any" />
          </label>
        </div>
        <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white">
          Apply
        </button>
      </form>
      {groups.map((g) => {
        const defs = facets.filter((d) => g.keys.includes(d.key));
        if (!defs.length) return null;
        return (
          <div key={g.title} className="px-4 py-3 space-y-2.5" style={sectionStyle}>
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              {g.title}
            </div>
            {defs.map((d) => {
              const options = context.options[d.key] ?? [];
              if (!options.length) return null;
              return (
                <div key={d.key}>
                  <div className="text-[11px] font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
                    {d.label}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map((v) => {
                      const on = p.filters.sets[d.key]?.includes(v) ?? false;
                      return (
                        <Link
                          key={v}
                          href={`${path}${toggleFacet(p, d.key, v)}`}
                          aria-pressed={on}
                          className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                          style={on ? { background: "var(--color-brand-600)", color: "#fff", border: "1px solid var(--color-brand-600)" } : { background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-strong)" }}
                        >
                          {v}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <Link href={here({ ...Object.fromEntries(FACETS.map((d) => [d.key, null])), cust: null, inv: null, min: null, max: null, all: null })} className="block px-4 py-3 text-xs font-bold text-brand-600" style={sectionStyle}>
        Clear every filter
      </Link>
    </div>
  );
}

function activeCount(p: ReportParams, report: ReportKind) {
  let n = FACETS.filter((d) => d.reports.includes(report) && p.filters.sets[d.key]?.length).length;
  if (p.filters.customer.trim()) n++;
  if (p.filters.invoiceNo.trim()) n++;
  if (p.filters.min !== null) n++;
  if (p.filters.max !== null) n++;
  return n;
}

/** Title, the three report tabs, the filter column, the grouping and export controls, and a line saying exactly what is on screen. */
export function ReportFrame({ report, p, context, children }: { report: ReportKind; p: ReportParams; context: ReportContext; children: React.ReactNode }) {
  const path = `/reports/${report}`;
  const q = (change: Record<string, string | null> = {}) => `${path}${toQuery(p, change)}`;
  const range = context.range;
  const days = Math.round((new Date(`${range.to}T00:00:00Z`).getTime() - new Date(`${range.from}T00:00:00Z`).getTime()) / 864e5) + 1;
  const prev = previousRange(range);
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  const chips: { label: string; href: string }[] = [];
  for (const d of FACETS) {
    const v = p.filters.sets[d.key];
    if (d.reports.includes(report) && v?.length) chips.push({ label: `${d.label}: ${v.join(", ")}`, href: q({ [d.key]: null, all: null }) });
  }
  if (p.filters.customer.trim()) chips.push({ label: `Customer contains "${p.filters.customer.trim()}"`, href: q({ cust: null, all: null }) });
  if (p.filters.invoiceNo.trim()) chips.push({ label: `Invoice ${p.filters.invoiceNo.trim()}`, href: q({ inv: null, all: null }) });
  if (p.filters.min !== null) chips.push({ label: `From $${p.filters.min}`, href: q({ min: null, all: null }) });
  if (p.filters.max !== null) chips.push({ label: `Up to $${p.filters.max}`, href: q({ max: null, all: null }) });
  const exportHref = `/reports/export${toQuery(p, { report })}`;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <ReportIcon className="w-5 h-5 text-orange-400" />
          {TITLES[report]}
        </h1>
        <p className="text-xs mt-0.5 max-w-3xl" style={{ color: "var(--text-muted)" }}>
          {EXPLAIN[report]}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 print:hidden" role="tablist" aria-label="Reports">
        {TABS.map((t) => {
          const on = t.report === report;
          return (
            <Link
              key={t.report}
              href={`/reports/${t.report}${toQuery(p, { all: null })}`}
              role="tab"
              aria-selected={on}
              className="rounded-xl px-4 py-2.5 block"
              style={{ background: "var(--bg-surface)", border: on ? "2px solid var(--color-brand-600)" : "1px solid var(--border-subtle)" }}
            >
              <div className="text-sm font-extrabold" style={{ color: on ? "var(--color-brand-600)" : "var(--text-primary)" }}>
                {t.label}
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {t.blurb}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[17.5rem_minmax(0,1fr)] items-start">
        <aside className="print:hidden lg:sticky lg:top-2 lg:max-h-[calc(100vh-1rem)] lg:overflow-y-auto" aria-label="Filters">
          <FilterDetails count={activeCount(p, report)}>
            <FilterBody report={report} p={p} context={context} />
          </FilterDetails>
        </aside>

        <div className="space-y-4 min-w-0">
          <div className="rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 print:hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
              <span>Group by</span>
              <Seg items={(["day", "week", "month"] as const).map((g) => ({ label: g[0].toUpperCase() + g.slice(1), href: q({ group: g === "day" ? null : g }), on: p.group === g }))} />
              <Link href={q({ cmp: p.compare ? "0" : null })} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3.5 rounded border text-[10px] leading-3 text-center" style={p.compare ? { background: "var(--color-brand-600)", borderColor: "var(--color-brand-600)", color: "#fff" } : { borderColor: "var(--border-strong)" }}>
                  {p.compare ? "✓" : ""}
                </span>
                Compare with the period before
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={exportHref} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white">
                Download CSV
              </a>
              <PrintButton />
            </div>
          </div>

          <div className="text-[11px] flex flex-wrap items-center gap-x-2 gap-y-1.5" style={{ color: "var(--text-muted)" }}>
            <span>
              <b style={{ color: "var(--text-secondary)" }}>
                {sameYear ? shortDate(range.from) : longDate(range.from)} to {longDate(range.to)}
              </b>
              , {days} day{days === 1 ? "" : "s"}
              {p.compare ? `; compared with ${shortDate(prev.from)} to ${shortDate(prev.to)}` : ""}
            </span>
            {chips.length > 0 && <span>·</span>}
            {chips.map((c) => (
              <Link key={c.label} href={c.href} className="inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-2 py-0.5 font-bold" style={{ background: "var(--color-info-subtle)", color: "var(--color-brand-600)" }} title="Remove this filter">
                {c.label} <span aria-hidden>×</span>
              </Link>
            ))}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
