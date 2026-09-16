"use client";

import { useState } from "react";

export interface SentEmailItem {
  id: string;
  to: string;
  subject: string;
  html: string;
  success: boolean;
  provider: string | null;
  errorMessage: string | null;
  createdAt: string;
}

/**
 * A permanent, exact copy of every email tied to this record — not a
 * re-rendering of current data, but literally what was handed to the
 * email provider at send time (see SentEmail's schema comment / sendMail()
 * in src/lib/email.ts). Click a row to see exactly what the customer got.
 */
export function SentEmailsPanel({ emails }: { emails: SentEmailItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = emails.find((e) => e.id === openId) ?? null;

  if (emails.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Nothing sent yet.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {emails.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setOpenId(e.id)}
            className="w-full flex items-center justify-between gap-3 rounded-lg p-3 text-left transition hover:bg-slate-50"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
          >
            <div className="min-w-0">
              <div className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                {e.subject}
              </div>
              <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                To {e.to} · {new Date(e.createdAt).toLocaleString()}
                {e.provider ? ` · via ${e.provider}` : ""}
              </div>
            </div>
            <span className={`dt-badge dt-badge--${e.success ? "success" : "error"} shrink-0`}>
              <span className="dt-badge-dot" />
              {e.success ? "Sent" : "Failed"}
            </span>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setOpenId(null)}>
          <div
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                    {open.subject}
                  </h3>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    To {open.to} · {new Date(open.createdAt).toLocaleString()}
                    {open.provider ? ` · via ${open.provider}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setOpenId(null)} aria-label="Close" className="text-xs font-bold shrink-0" style={{ color: "var(--text-muted)" }}>
                  Close ✕
                </button>
              </div>
              {!open.success && (
                <p className="text-xs font-semibold mt-2" style={{ color: "var(--color-error-solid)" }}>
                  Failed to send{open.errorMessage ? `: ${open.errorMessage}` : "."}
                </p>
              )}
            </div>
            <iframe title="Email preview" srcDoc={open.html} sandbox="" className="flex-1 w-full bg-white" />
          </div>
        </div>
      )}
    </>
  );
}
