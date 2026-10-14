import Link from "next/link";
import { shortDate, type Chart, type DetailCol, type DetailTable, type GroupRow } from "@/lib/report-engine";

export const fmtMoney = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtMoney0 = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;
export const fmtPct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function cell(kind: DetailCol["kind"], v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  if (kind === "money") return fmtMoney(Number(v));
  if (kind === "date") return shortDate(String(v));
  if (kind === "int") return Number(v).toLocaleString("en-CA", { maximumFractionDigits: 2 });
  if (kind === "pct") return fmtPct(Number(v));
  return String(v);
}

const border = { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" };

export function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-4 space-y-3 min-w-0" style={border}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
        {sub && (
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {sub}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children = "Nothing matches these filters." }: { children?: React.ReactNode }) {
  return (
    <p className="text-xs py-6 text-center" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

/** One key number. `change` is the move against the period before (0.12 = up 12%); `goodUp` says whether up is the good direction. */
export function Kpi({ label, value, sub, change, goodUp = true }: { label: string; value: string; sub?: string; change?: number | null; goodUp?: boolean }) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="rounded-xl px-4 py-3 min-w-0" style={border}>
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-xl font-bold font-mono tracking-tight tabular-nums" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
      <div className="text-[11px] flex flex-wrap gap-x-2" style={{ color: "var(--text-muted)" }}>
        {change !== null && change !== undefined && Number.isFinite(change) && (
          <span className="font-bold" style={{ color: up === goodUp ? "var(--color-success-solid)" : "var(--color-error-solid)" }}>
            {up ? "▲" : "▼"} {Math.abs(change * 100).toFixed(0)}%
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

export const KpiRow = ({ children }: { children: React.ReactNode }) => <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))]">{children}</div>;

export const SERIES_COLORS = ["#0f52ba", "#0d9488", "#d97706", "#7c3aed", "#64748b", "#db2777"];

export function Legend({ names }: { names: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
      {names.map((n, i) => (
        <span key={n} className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
          {n}
        </span>
      ))}
    </div>
  );
}

function niceMax(v: number) {
  const m = Math.pow(10, Math.floor(Math.log10(v)));
  for (const c of [1, 2, 2.5, 5, 10]) if (c * m >= v) return c * m;
  return 10 * m;
}

/** Stacked columns, one per period, drawn to a single scale. */
export function StackedChart({ chart, label }: { chart: Chart; label: string }) {
  const W = 760, H = 230, ml = 54, mr = 8, mt = 10, mb = 28;
  const iw = W - ml - mr, ih = H - mt - mb;
  const totals = chart.periods.map((_, i) => chart.series.reduce((t, s) => t + s.values[i], 0));
  const max = niceMax(Math.max(1, ...totals));
  const bw = iw / Math.max(1, chart.periods.length);
  const w = Math.max(2, Math.min(46, bw * 0.7));
  const step = Math.ceil(chart.periods.length / 11);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full h-auto">
      {[0, 1, 2, 3, 4].map((i) => {
        const y = mt + ih - (ih * i) / 4;
        return (
          <g key={i}>
            <line x1={ml} x2={W - mr} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth={1} />
            <text x={ml - 6} y={y + 3.5} textAnchor="end" fontSize={10.5} fill="var(--text-muted)">
              {fmtMoney0((max * i) / 4)}
            </text>
          </g>
        );
      })}
      {chart.periods.map((p, idx) => {
        const x = ml + bw * idx + (bw - w) / 2;
        let yb = mt + ih;
        return (
          <g key={p}>
            {chart.series.map((s, si) => {
              const v = s.values[idx];
              if (v <= 0) return null;
              const h = (ih * v) / max;
              yb -= h;
              return (
                <rect key={s.name} x={x} y={yb} width={w} height={h} rx={1.5} fill={SERIES_COLORS[si % SERIES_COLORS.length]}>
                  <title>{`${chart.labels[idx]}: ${s.name} ${fmtMoney(v)} (total ${fmtMoney(totals[idx])})`}</title>
                </rect>
              );
            })}
            {idx % step === 0 && (
              <text x={x + w / 2} y={H - 9} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)">
                {chart.labels[idx]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const th = "text-left text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 whitespace-nowrap";
const td = "px-2.5 py-1.5 align-top";

export function Share({ value, total }: { value: number; total: number }) {
  const p = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-16 h-1.5 rounded overflow-hidden" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
        <span className="block h-full" style={{ width: `${(p * 100).toFixed(0)}%`, background: "var(--color-brand-600)" }} />
      </span>
      {(p * 100).toFixed(0)}%
    </span>
  );
}

/** A small table of groups (technician, payment method …). Rows link to the same report narrowed to that group. */
export function GroupTable({ head, rows, hrefFor, foot, columns }: { head: string; rows: GroupRow[]; hrefFor: (r: GroupRow) => string | null; foot?: React.ReactNode; columns: { h: string; value: (r: GroupRow) => React.ReactNode }[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-strong)" }}>
            <th className={th}>{head}</th>
            {columns.map((c) => (
              <th key={c.h} className={`${th} text-right`}>
                {c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = hrefFor(r);
            return (
              <tr key={`${r.facet}-${r.key}`} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td className={`${td} font-semibold`} style={{ color: "var(--text-primary)" }}>
                  {href ? (
                    <Link href={href} className="hover:underline" title="Show only this">
                      {r.label}
                    </Link>
                  ) : (
                    r.label
                  )}
                </td>
                {columns.map((c) => (
                  <td key={c.h} className={`${td} text-right font-mono tabular-nums whitespace-nowrap`}>
                    {c.value(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {foot}
      </table>
    </div>
  );
}

export function DetailTableView({ table, limit, moreHref, lessHref, shown }: { table: DetailTable; limit: number; moreHref: string; lessHref: string; shown: boolean }) {
  if (!table.rows.length) return <Empty />;
  const rows = shown ? table.rows : table.rows.slice(0, limit);
  const numeric = (k: DetailCol["kind"]) => k === "money" || k === "int" || k === "pct";
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-strong)" }}>
              {table.cols.map((c) => (
                <th key={c.h} className={`${th} ${numeric(c.kind) ? "text-right" : ""}`}>
                  {c.h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {table.cols.map((c, ci) => (
                  <td key={c.h} className={`${td} ${numeric(c.kind) ? "text-right font-mono tabular-nums whitespace-nowrap" : ci === 0 ? "whitespace-nowrap" : ""}`} style={{ color: "var(--text-primary)" }}>
                    {cell(c.kind, r[ci])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {table.foot && (
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border-strong)" }}>
                {table.cols.map((c, ci) => (
                  <td key={c.h} className={`${td} font-extrabold ${numeric(c.kind) ? "text-right font-mono tabular-nums whitespace-nowrap" : ""}`} style={{ color: "var(--text-primary)" }}>
                    {cell(c.kind, table.foot![ci])}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {table.rows.length > limit && (
        <Link href={shown ? lessHref : moreHref} className="text-xs font-bold text-brand-600">
          {shown ? "Show fewer rows" : `Show all ${table.rows.length} rows`}
        </Link>
      )}
    </div>
  );
}

export function Seg({ items }: { items: { label: string; href: string; on: boolean }[] }) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-strong)" }}>
      {items.map((it) => (
        <Link key={it.label} href={it.href} aria-current={it.on ? "true" : undefined} className="px-3 py-1.5 text-[11px] font-bold" style={it.on ? { background: "var(--color-brand-600)", color: "#fff" } : { background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
          {it.label}
        </Link>
      ))}
    </div>
  );
}
