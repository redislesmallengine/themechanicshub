import { STATUS_LABELS as WO_STATUS_LABELS, type WorkOrderStatus } from "@/lib/work-orders";
import type { RevenuePoint, StatusCount, WeeklyThroughput, TypeRevenue } from "@/lib/dashboard";

/**
 * Every chart on this page is server-rendered inline SVG, computed from
 * real numbers at request time — deliberately not a client charting
 * library. That keeps the dashboard's client JS bundle at zero for the
 * charts specifically: nothing to download, parse, or hydrate before a
 * chart is visible: it's just part of the HTML the server already sent.
 */

export function RevenueTrendChartSvg({ points }: { points: RevenuePoint[] }) {
  const width = 640;
  const height = 210;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const n = points.length;
  const maxVal = Math.max(...points.map((p) => p.total), 0);
  const niceMax = maxVal <= 0 ? 100 : Math.ceil(maxVal / 100) * 100;

  const xFor = (i: number) => padLeft + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yFor = (v: number) => padTop + plotH - (v / niceMax) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(p.total).toFixed(1)}`).join(" ");
  const areaPath = n > 0 ? `${linePath} L${xFor(n - 1).toFixed(1)},${(padTop + plotH).toFixed(1)} L${xFor(0).toFixed(1)},${(padTop + plotH).toFixed(1)} Z` : "";
  const last = points[n - 1];
  const gridFractions = [0, 0.25, 0.5, 0.75, 1];
  const labelIndexes = n > 0 ? Array.from(new Set([0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1])) : [];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
      {gridFractions.map((f) => {
        const y = padTop + plotH * (1 - f);
        return (
          <g key={f}>
            <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke={f === 0 ? "var(--border-strong)" : "var(--border-subtle)"} />
            <text x={padLeft - 8} y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-muted)" fontFamily="JetBrains Mono, monospace">
              {Math.round(niceMax * f)}
            </text>
          </g>
        );
      })}
      {n > 0 && <path d={areaPath} fill="var(--color-brand-500)" opacity="0.09" />}
      {n > 0 && <path d={linePath} fill="none" stroke="var(--color-brand-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {last && <circle cx={xFor(n - 1)} cy={yFor(last.total)} r="4.5" fill="var(--color-brand-600)" stroke="#fff" strokeWidth="2" />}
      {labelIndexes.map((i) => (
        <text
          key={i}
          x={xFor(i)}
          y={height - 6}
          fontSize="9"
          fill="var(--text-muted)"
          textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
        >
          {new Date(`${points[i].date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
      ))}
    </svg>
  );
}

const STATUS_BAR_COLOR: Partial<Record<WorkOrderStatus, string>> = {
  droppedOff: "var(--color-info-solid)",
  diagnosing: "var(--color-info-solid)",
  awaitingApproval: "var(--color-warning-solid)",
  inRepair: "var(--color-info-solid)",
  readyForPickup: "var(--color-success-solid)",
};

export function WorkOrdersByStatusChartSvg({ counts }: { counts: StatusCount[] }) {
  const width = 260;
  const rowH = 34;
  const height = counts.length * rowH;
  const maxVal = Math.max(...counts.map((c) => c.count), 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      {counts.map((c, i) => {
        const y = i * rowH;
        const w = c.count > 0 ? Math.max((c.count / maxVal) * width, 22) : 0;
        const labelInside = w > 26;
        return (
          <g key={c.status}>
            <text x={0} y={y + 11} fontSize="10" fill="var(--text-secondary)">
              {WO_STATUS_LABELS[c.status as WorkOrderStatus]}
            </text>
            <rect x={0} y={y + 16} width={w} height={13} rx={3} fill={STATUS_BAR_COLOR[c.status as WorkOrderStatus] ?? "var(--color-info-solid)"} />
            <text
              x={labelInside ? w - 6 : w + 6}
              y={y + 26}
              fontSize="10"
              fontWeight="700"
              fill={labelInside ? "#fff" : "var(--text-primary)"}
              textAnchor={labelInside ? "end" : "start"}
              fontFamily="JetBrains Mono, monospace"
            >
              {c.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function OpenedVsClosedChartSvg({ weeks }: { weeks: WeeklyThroughput[] }) {
  const width = 480;
  const height = 170;
  const padBottom = 26;
  const padTop = 10;
  const plotH = height - padTop - padBottom;
  const maxVal = Math.max(...weeks.flatMap((w) => [w.opened, w.closed]), 1);
  const groupW = (width - 50) / weeks.length;
  const barW = 15;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      <line x1={30} y1={height - padBottom} x2={width - 10} y2={height - padBottom} stroke="var(--border-strong)" />
      {weeks.map((w, i) => {
        const gx = 36 + i * groupW;
        const openedH = (w.opened / maxVal) * plotH;
        const closedH = (w.closed / maxVal) * plotH;
        return (
          <g key={w.weekStart}>
            <rect x={gx} y={height - padBottom - openedH} width={barW} height={openedH} fill="var(--color-brand-500)" rx="2" />
            <rect x={gx + barW + 2} y={height - padBottom - closedH} width={barW} height={closedH} fill="var(--color-success-solid)" rx="2" />
            <text x={gx + barW} y={height - 10} fontSize="9" fill="var(--text-muted)" textAnchor="middle">
              {new Date(`${w.weekStart}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const TYPE_COLOR: Record<string, string> = {
  repairService: "var(--color-success-solid)",
  partsOnly: "var(--color-info-solid)",
  combined: "var(--color-warning-solid)",
};

const TYPE_LABEL: Record<string, string> = {
  repairService: "Repair Service",
  partsOnly: "Parts Only",
  combined: "Repair + Extra",
};

export function RevenueByTypeDonutSvg({ items }: { items: TypeRevenue[] }) {
  const total = items.reduce((sum, i) => sum + i.total, 0);
  const r = 70;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * r;
  const filtered = items.filter((i) => i.total > 0);
  const dashes = filtered.map((i) => (total > 0 ? (i.total / total) * circumference : 0));
  const segments = filtered.map((i, idx) => ({
    ...i,
    frac: total > 0 ? i.total / total : 0,
    dash: dashes[idx],
    offset: -dashes.slice(0, idx).reduce((sum, d) => sum + d, 0),
  }));

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 180 180" width={150} height={150}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="24" />
          {segments.map((s) => (
            <circle
              key={s.invoiceType}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={TYPE_COLOR[s.invoiceType] ?? "var(--text-muted)"}
              strokeWidth="24"
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={s.offset}
            />
          ))}
        </g>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--text-primary)" fontFamily="JetBrains Mono, monospace">
          ${total.toFixed(0)}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
          this month
        </text>
      </svg>
      <div className="flex flex-col gap-2">
        {segments.length === 0 && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            No paid invoices this month yet.
          </span>
        )}
        {segments.map((s) => (
          <span key={s.invoiceType} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: TYPE_COLOR[s.invoiceType] ?? "var(--text-muted)" }} />
            {TYPE_LABEL[s.invoiceType] ?? s.invoiceType} — {(s.frac * 100).toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}
