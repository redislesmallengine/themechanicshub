const TONE_STYLES = {
  neutral: { border: "var(--border-subtle)", bg: "var(--bg-surface)", label: "var(--text-muted)", value: "var(--text-primary)", sub: "var(--text-muted)" },
  warning: {
    border: "var(--color-warning-border)",
    bg: "var(--color-warning-subtle)",
    label: "var(--color-warning-text)",
    value: "var(--color-warning-text)",
    sub: "var(--color-warning-text)",
  },
  error: { border: "var(--color-error-border)", bg: "var(--color-error-subtle)", label: "var(--color-error-text)", value: "var(--color-error-text)", sub: "var(--color-error-text)" },
  success: {
    border: "var(--color-success-border)",
    bg: "var(--color-success-subtle)",
    label: "var(--color-success-text)",
    value: "var(--color-success-text)",
    sub: "var(--color-success-text)",
  },
} as const;

export function StatTile({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: keyof typeof TONE_STYLES }) {
  const t = TONE_STYLES[tone];
  return (
    <div className="rounded-xl p-4" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: t.label }}>
        {label}
      </div>
      <div className="num text-xl font-extrabold mt-1" style={{ color: t.value }}>
        {value}
      </div>
      {sub && (
        <div className="text-[10.5px] mt-1" style={{ color: t.sub }}>
          {sub}
        </div>
      )}
    </div>
  );
}
