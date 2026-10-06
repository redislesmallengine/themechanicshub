/**
 * What the "Preview & Send" popups switch to after a successful send, so there
 * is a clear sign the email actually went out (before this the popup just sat
 * there looking unchanged). The page behind refreshes when this is closed.
 */
export function EmailSentNotice({ title, to, detail, onClose }: { title: string; to: string | null; detail?: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
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
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {to ? (
            <>
              Sent to <b style={{ color: "var(--text-primary)" }}>{to}</b>.
            </>
          ) : (
            "Sent."
          )}
          {detail ? ` ${detail}` : ""}
        </p>
        <button type="button" onClick={onClose} className="mt-5 px-6 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white">
          Close
        </button>
      </div>
    </div>
  );
}
