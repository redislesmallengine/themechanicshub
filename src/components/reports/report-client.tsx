"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PRESETS, PRESET_LABELS, type Preset } from "@/lib/report-engine";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

/** The date range: pick a preset and the report reloads; "Pick dates…" shows two date boxes and an Apply button. */
export function DateRangeForm({ basePath, baseQuery, preset, from, to }: { basePath: string; baseQuery: string; preset: Preset; from: string; to: string }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Preset>(preset);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const join = (extra: string) => `${basePath}${baseQuery}${baseQuery ? "&" : "?"}${extra}`;

  function onPreset(value: Preset) {
    setPicked(value);
    if (value !== "custom") router.push(join(`preset=${value}`));
  }

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
        Date range
        <select value={picked} onChange={(e) => onPreset(e.target.value as Preset)} className="mt-1 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={inputStyle}>
          {PRESETS.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      {picked === "custom" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (start && end) router.push(join(`preset=custom&from=${start}&to=${end}`));
          }}
          className="space-y-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
              From
              <input type="date" required value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded-lg text-xs" style={inputStyle} />
            </label>
            <label className="block text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
              To
              <input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded-lg text-xs" style={inputStyle} />
            </label>
          </div>
          <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white">
            Apply dates
          </button>
        </form>
      )}
    </div>
  );
}

/** The filter panel: open on a wide screen, folded on a phone so the numbers come first. */
export function FilterDetails({ count, children }: { count: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.open = window.matchMedia("(min-width: 1024px)").matches;
  }, []);
  return (
    <details ref={ref} open className="rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
        Filters
        {count > 0 && <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-brand-600 text-white">{count}</span>}
      </summary>
      {children}
    </details>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}>
      Print or save as PDF
    </button>
  );
}
