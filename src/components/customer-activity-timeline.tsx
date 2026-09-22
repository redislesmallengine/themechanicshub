import type { ActivityEntry, ActivityTone } from "@/lib/customer-activity";

const TONE_COLOR: Record<ActivityTone, string> = {
  success: "var(--color-success-solid)",
  warning: "var(--color-warning-solid)",
  error: "var(--color-error-solid)",
  info: "var(--color-info-solid)",
  neutral: "var(--text-muted)",
};

export function CustomerActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        No activity yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {entries.map((entry, i) => (
        <div key={entry.id} className="flex gap-3.5">
          <div className="flex flex-col items-center w-3.5 shrink-0">
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: TONE_COLOR[entry.tone] }} />
            {i < entries.length - 1 && <div className="w-px flex-1" style={{ background: "var(--border-subtle)" }} />}
          </div>
          <div className={i < entries.length - 1 ? "pb-4" : ""}>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              <span className="font-bold">{entry.label}</span>
              {entry.detail && <> — {entry.detail}</>}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {entry.date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              {" · "}
              {entry.date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
