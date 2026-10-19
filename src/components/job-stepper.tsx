import Link from "next/link";
import { STEP_ROW, stepIndex, STATUS_LABELS, viewableSteps, type StepTarget, type WorkOrderStatus } from "@/lib/work-orders";

/**
 * The seven steps across the top of a job. Green steps are done and can be clicked to LOOK at them: the page shows
 * that step and the job stays where it is (nothing is moved or cleared). The blue step is where the job really is;
 * while looking at an earlier step, a click on it comes back. A step being looked at has a dark outline.
 */
export function JobStepper({
  workOrderId,
  status,
  hasInvoice,
  repairFinished,
  viewing,
}: {
  workOrderId: string;
  status: WorkOrderStatus;
  hasInvoice: boolean;
  repairFinished: boolean;
  /** The earlier step currently on screen, if any. */
  viewing: StepTarget | null;
}) {
  const current = stepIndex(status, repairFinished);
  const declined = status === "declined";
  const viewable = new Set<StepTarget>(viewableSteps(status, repairFinished, hasInvoice));
  const basePath = `/work-orders/${workOrderId}`;
  const currentLabel = declined ? STATUS_LABELS.declined : STEP_ROW[current].label;
  const viewingLabel = viewing ? STEP_ROW.find((s) => s.target === viewing)?.label : null;

  return (
    <div>
      <ol className="relative grid grid-cols-7 gap-1" aria-label="Where this job is">
        {/* the track behind the dots, filled up to the current step */}
        <span aria-hidden className="absolute top-[13px] h-0.5 rounded" style={{ left: "calc(100% / 14)", right: "calc(100% / 14)", background: "var(--border-strong)" }} />
        <span aria-hidden className="absolute top-[13px] h-0.5 rounded" style={{ left: "calc(100% / 14)", width: `calc((100% - 100% / 7) * ${current / (STEP_ROW.length - 1)})`, background: "var(--color-success-solid)" }} />
        {STEP_ROW.map((step, i) => {
          const done = i < current;
          const now = i === current;
          const isViewing = viewing === step.target;
          const clickable = (done && viewable.has(step.target)) || (now && viewing !== null);
          const label = now && declined ? STATUS_LABELS.declined : step.label;
          const dot = (
            <span
              className="relative z-10 grid place-items-center w-7 h-7 rounded-full text-xs font-extrabold"
              style={
                done
                  ? { background: "var(--color-success-solid)", color: "#fff", border: "2px solid var(--color-success-solid)", ...(isViewing ? { boxShadow: "0 0 0 3px var(--bg-surface), 0 0 0 5px var(--text-primary)" } : {}) }
                  : now
                    ? { background: "var(--bg-surface)", color: declined ? "var(--color-error-solid)" : "var(--color-brand-600)", border: `2px solid ${declined ? "var(--color-error-solid)" : "var(--color-brand-600)"}`, boxShadow: `0 0 0 4px ${declined ? "var(--color-error-subtle)" : "var(--color-info-subtle)"}` }
                    : { background: "var(--bg-surface)", color: "var(--text-muted)", border: "2px solid var(--border-strong)" }
              }
            >
              {done ? "✓" : now && declined ? "×" : i + 1}
            </span>
          );
          const text = (
            <span
              className={`text-[11px] sm:text-xs font-bold text-center leading-tight${clickable ? " underline decoration-dotted underline-offset-4" : ""}`}
              style={{ color: done ? "var(--color-success-solid)" : now ? (declined ? "var(--color-error-solid)" : "var(--color-brand-600)") : "var(--text-muted)" }}
            >
              {label}
            </span>
          );
          return (
            <li key={step.target} className="flex" aria-current={now ? "step" : undefined}>
              {clickable ? (
                <Link href={now ? basePath : `${basePath}?view=${step.target}`} scroll={false} title={now ? `Back to ${label}` : `Look at ${label}`} className="job-step-link w-full flex flex-col items-center gap-1.5 rounded-lg cursor-pointer">
                  {dot}
                  {text}
                </Link>
              ) : (
                <div className="w-full flex flex-col items-center gap-1.5">
                  {dot}
                  {text}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] mt-2">
        {viewing
          ? `You are looking at ${viewingLabel}. The job is still on ${currentLabel}. Click ${currentLabel} to go back to it.`
          : viewable.size > 0
            ? "Click an underlined green step to look at it. The job stays where it is."
            : "The blue step is where this job is now."}
      </p>
    </div>
  );
}
