export type SortDir = "asc" | "desc";

/**
 * Reads ?sort= / ?dir= for a list page. `fields` is the allow-list of sortable
 * column keys; anything else falls back to the page's default ordering.
 * `explicit` is true only when the visitor picked a column, so the default
 * view keeps its clean URL (and its own opinion about ordering).
 */
export function parseSort<T extends string>(
  sortRaw: string | undefined,
  dirRaw: string | undefined,
  fields: readonly T[],
  fallback: { field: T | null; dir: SortDir }
): { field: T | null; dir: SortDir; explicit: boolean } {
  if (sortRaw && (fields as readonly string[]).includes(sortRaw)) {
    return { field: sortRaw as T, dir: dirRaw === "desc" ? "desc" : "asc", explicit: true };
  }
  return { ...fallback, explicit: false };
}

/** The query params that carry the current sort onto Prev/Next links and forms. */
export function sortQuery(s: { field: string | null; dir: SortDir; explicit: boolean }): Record<string, string | undefined> {
  return s.explicit && s.field ? { sort: s.field, dir: s.dir } : {};
}
