import Link from "next/link";

/**
 * Server-rendered Prev/Next pagination — plain links carrying the page
 * number in the query string, no client JS needed. Shared across any list
 * page that outgrows "just fetch everything and render it" — Inventory is
 * the first to actually need it at real scale, but every other list page
 * (Customers, Equipment, Work Orders, Invoices) has the same shape of
 * problem once its row count grows, so this is built to drop into any of
 * them rather than being Inventory-specific.
 */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
  pageSizeOptions,
  defaultPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  /** Every other active query param (search term, filters) to carry forward onto the Prev/Next links. */
  params?: Record<string, string | undefined>;
  /** When given, shows a "Per page" selector. Choosing a size sets ?pageSize= (omitted when it equals defaultPageSize) and goes back to page 1. */
  pageSizeOptions?: number[];
  defaultPageSize?: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function hrefFor(p: number) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) sp.set(key, value);
    }
    if (pageSizeOptions && pageSize !== defaultPageSize) sp.set("pageSize", String(pageSize));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  function hrefForSize(size: number) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) sp.set(key, value);
    }
    if (size !== defaultPageSize) sp.set("pageSize", String(size));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const navButtonStyle = { background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>{total === 0 ? "No results" : `Showing ${from}–${to} of ${total.toLocaleString()}`}</span>
        {pageSizeOptions && (
          <span className="flex items-center gap-1.5">
            <span className="font-semibold">Per page:</span>
            {pageSizeOptions.map((size) => (
              <Link
                key={size}
                href={hrefForSize(size)}
                className="px-2 py-0.5 rounded-md font-bold"
                style={
                  size === pageSize
                    ? { background: "var(--color-brand-600)", color: "#fff" }
                    : { background: "var(--bg-surface-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }
                }
              >
                {size}
              </Link>
            ))}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-50" style={navButtonStyle}>
            ← Prev
          </Link>
        ) : (
          <span className="px-3 py-1.5 rounded-lg font-semibold opacity-40" style={navButtonStyle}>
            ← Prev
          </span>
        )}
        <span className="font-semibold px-1" style={{ color: "var(--text-secondary)" }}>
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className="px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-50" style={navButtonStyle}>
            Next →
          </Link>
        ) : (
          <span className="px-3 py-1.5 rounded-lg font-semibold opacity-40" style={navButtonStyle}>
            Next →
          </span>
        )}
      </div>
    </div>
  );
}
