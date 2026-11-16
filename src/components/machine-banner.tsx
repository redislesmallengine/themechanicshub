import { splitMachineHeading } from "@/lib/equipment-label";

/** The heading of one machine's section on a merged invoice: a number, the equipment type, and the make, model and work order below it. */
export function MachineBanner({ number, description }: { number?: number; description: string }) {
  const { title, subtitle } = splitMachineHeading(description);
  return (
    <div className="flex items-center gap-2.5">
      {number ? (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold shrink-0">{number}</span>
      ) : null}
      <div className="leading-snug">
        <div className="text-sm font-bold text-brand-700">{title}</div>
        {subtitle && (
          <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
