"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { dismissGettingStarted } from "@/app/(app)/dashboard/actions";

interface ChecklistItem {
  label: string;
  done: boolean;
  href: string;
  cta: string;
}

function CheckCircle({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0" style={{ background: "var(--color-success-solid)" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  return <span className="inline-block w-5 h-5 rounded-full shrink-0" style={{ border: "2px solid var(--border-strong)" }} />;
}

export function GettingStartedChecklist({ items }: { items: ChecklistItem[] }) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();
  const doneCount = items.filter((i) => i.done).length;

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    startTransition(async () => {
      await dismissGettingStarted();
    });
  }

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
            Getting Started
          </h2>
          <span className="text-xs font-semibold num" style={{ color: "var(--text-muted)" }}>
            {doneCount} of {items.length} done
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={pending}
          className="text-xs font-semibold disabled:opacity-60"
          style={{ color: "var(--text-muted)" }}
          aria-label="Dismiss Getting Started checklist"
        >
          Dismiss
        </button>
      </div>

      <div className="w-full h-1.5 rounded-full overflow-hidden mt-2 mb-4" style={{ background: "var(--bg-surface-subtle)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / items.length) * 100}%`, background: "var(--color-brand-600)" }} />
      </div>

      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle done={item.done} />
              <span className="text-sm font-semibold" style={{ color: item.done ? "var(--text-muted)" : "var(--text-primary)", textDecoration: item.done ? "line-through" : "none" }}>
                {item.label}
              </span>
            </div>
            {!item.done && (
              <Link href={item.href} className="text-xs font-bold text-brand-600 whitespace-nowrap">
                {item.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
