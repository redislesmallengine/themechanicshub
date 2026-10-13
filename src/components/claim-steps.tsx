import { claimStage, type ClaimStage } from "@/lib/warranty";

const STEPS: { stage: Exclude<ClaimStage, "void">; label: string }[] = [
  { stage: "notSubmitted", label: "Not submitted" },
  { stage: "submitted", label: "Submitted" },
  { stage: "paid", label: "Paid" },
];

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : null);

/** A warranty claim's three steps with the dates each happened: Not submitted -> Submitted (date) -> Paid (date). */
export function ClaimSteps({ status, submittedAt, paidAt, compact = false }: { status: string; submittedAt: Date | null; paidAt: Date | null; compact?: boolean }) {
  const stage = claimStage(status);
  if (stage === "void") {
    return (
      <span className="dt-badge dt-badge--error">
        <span className="dt-badge-dot" />
        Void
      </span>
    );
  }
  const current = STEPS.findIndex((s) => s.stage === stage);

  return (
    <ol className={`flex items-center ${compact ? "gap-1" : "gap-1.5"} list-none`} aria-label="Claim steps">
      {STEPS.map((step, i) => {
        const done = i < current || (stage === "paid" && i === current);
        const now = i === current && stage !== "paid";
        const date = step.stage === "submitted" ? fmt(submittedAt) : step.stage === "paid" ? fmt(paidAt) : null;
        return (
          <li key={step.stage} className="flex items-center gap-1" aria-current={now ? "step" : undefined}>
            {i > 0 && (
              <span aria-hidden="true" style={{ color: "var(--text-muted)" }}>
                ›
              </span>
            )}
            <span
              className={`rounded-md font-bold whitespace-nowrap ${compact ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2.5 py-1"}`}
              style={
                done
                  ? { background: "var(--color-success-subtle)", color: "var(--color-success-text)" }
                  : now
                    ? { background: "var(--color-brand-50, var(--bg-surface-subtle))", color: "var(--color-brand-600)", border: "1px solid var(--color-brand-600)" }
                    : { background: "var(--bg-surface-subtle)", color: "var(--text-muted)" }
              }
            >
              {done ? "✓ " : ""}
              {step.label}
              {date && (done || now) ? ` · ${date}` : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
