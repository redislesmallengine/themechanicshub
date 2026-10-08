import Link from "next/link";
import type { SortDir } from "@/lib/sort";

/**
 * A column header that sorts the list when clicked -- a plain link carrying
 * ?sort=&dir= (plus whatever filters are active), so it works with server-side
 * paging and needs no client JS. Clicking the active column flips its
 * direction; clicking another starts at `firstDir`. Always returns to page 1.
 */
export function SortTh({
  label,
  field,
  sort,
  dir,
  basePath,
  params,
  firstDir = "asc",
  align = "left",
}: {
  label: string;
  field: string;
  /** The column currently sorted on (null when the page is on its own default order). */
  sort: string | null;
  dir: SortDir;
  basePath: string;
  /** Every other active query param (search term, filters, page size) to keep. */
  params?: Record<string, string | undefined>;
  /** Direction on the first click -- "desc" suits dates and money, where newest/biggest first is what people want. */
  firstDir?: SortDir;
  align?: "left" | "right";
}) {
  const active = sort === field;
  const nextDir: SortDir = active ? (dir === "asc" ? "desc" : "asc") : firstDir;

  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) sp.set(key, value);
  }
  sp.set("sort", field);
  sp.set("dir", nextDir);

  return (
    <th className={`dt-th ${align === "right" ? "text-right" : "text-left"}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        href={`${basePath}?${sp.toString()}`}
        className="inline-flex items-center gap-1 hover:underline"
        style={{ color: "inherit" }}
        title={`Sort by ${label}`}
      >
        {label}
        <span aria-hidden="true" style={{ opacity: active ? 1 : 0.35, fontSize: "0.85em" }}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </th>
  );
}
