"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * A one-time "what's next" popup shown right after creating a customer or
 * piece of equipment -- driven by a `?created=1` marker the creating action
 * appends to its redirect target, not client-side state, so it survives the
 * full page load that follows a Server Action redirect. Dismissing strips
 * the marker from the URL so a refresh or back-navigation doesn't re-show
 * it; the header buttons that do the same thing stay put as a permanent
 * affordance -- this is an extra nudge, not the only way in.
 */
export function NextStepPrompt({
  show,
  title,
  message,
  ctaHref,
  ctaLabel,
}: {
  show: boolean;
  title: string;
  message: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    router.replace(pathname);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={dismiss}>
      <div
        className="w-full max-w-md rounded-2xl p-7 text-center"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-4" style={{ background: "var(--color-success-subtle)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-success-solid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h3 className="text-lg font-extrabold mb-1.5" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
        <Link
          href={ctaHref}
          className="block w-full px-5 py-3 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition"
        >
          {ctaLabel}
        </Link>
        <button type="button" onClick={dismiss} className="mt-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
