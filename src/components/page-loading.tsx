/** Full-page loading fallback used by every route's loading.tsx -- shown instantly on navigation while the destination route streams in, per Next.js's own recommended loading.js convention. */
export function PageLoading() {
  return (
    <div className="p-6 flex items-center justify-center" style={{ minHeight: "60vh" }}>
      <div className="flex items-center gap-2.5" style={{ color: "var(--text-muted)" }}>
        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-semibold">Loading…</span>
      </div>
    </div>
  );
}
