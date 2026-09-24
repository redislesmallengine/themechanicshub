import type { CSSProperties } from "react";

/** Shown inside a Suspense fallback while its section's query is still running — every dashboard section streams in independently, so this is what tells the user "this specific part is loading," not the whole page. */
export function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" style={{ color: "var(--text-muted)" }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function shimmer(style?: CSSProperties) {
  return { background: "var(--bg-surface-subtle)", ...style };
}

export function TileSkeleton() {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="h-2.5 w-16 rounded animate-pulse" style={shimmer()} />
      <div className="h-6 w-20 rounded mt-3 animate-pulse" style={shimmer()} />
      <div className="h-2 w-24 rounded mt-2 animate-pulse" style={shimmer()} />
    </div>
  );
}

export function TileRowSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <TileSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      className="rounded-xl p-5 flex items-center justify-center"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", height }}
    >
      <Spinner className="w-6 h-6" />
    </div>
  );
}

export function ListSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", height }}>
      <div className="h-3 w-40 rounded animate-pulse mb-4" style={shimmer()} />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-3 rounded animate-pulse" style={shimmer({ width: `${85 - i * 12}%` })} />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="rounded-xl p-5 flex items-center justify-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", height: 260 }}>
      <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
        <Spinner className="w-4 h-4" />
        <span className="text-xs font-semibold">Loading…</span>
      </div>
    </div>
  );
}
