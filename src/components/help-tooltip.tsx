/**
 * Small "?" icon that reveals a plain-language explanation on hover/focus —
 * pure CSS (Tailwind's `group`/`group-focus-within`), no JS state needed.
 * Use next to a field label wherever a non-technical user might not know
 * what to enter or where to find it.
 */
export function HelpTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group ml-1 align-middle">
      <button
        type="button"
        aria-label="More info"
        className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[9px] font-bold leading-none cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-muted)" }}
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-60 rounded-lg px-2.5 py-2 text-[10px] leading-snug font-normal normal-case opacity-0 scale-95 transition-all duration-100 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 shadow-lg"
        style={{ background: "var(--text-primary)", color: "var(--bg-surface)" }}
      >
        {text}
      </span>
    </span>
  );
}
