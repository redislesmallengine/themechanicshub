import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { InventoryIcon, SearchIcon } from "@/components/icons";
import { DeletePartButton } from "@/components/delete-part-button";
import { Pagination } from "@/components/pagination";
import { SavedViewsBar, type SavedViewItem } from "@/components/saved-views-bar";

const PAGE_SIZE = 50;

const STOCK_VIEWS = ["all", "in", "low", "out"] as const;
type StockView = (typeof STOCK_VIEWS)[number];

const STOCK_VIEW_LABELS: Record<StockView, string> = {
  all: "All Parts",
  in: "In Stock",
  low: "Low Stock",
  out: "Out of Stock",
};

interface PartRow {
  id: string;
  name: string;
  sku: string | null;
  quantityOnHand: number;
  reorderPoint: number;
  sellPrice: string | null;
  categoryName: string | null;
}

interface StockCounts {
  all: bigint;
  in_stock: bigint;
  low_stock: bigint;
  out_of_stock: bigint;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; stock?: string; page?: string }>;
}) {
  const { q, category, stock: stockRaw, page: pageRaw } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const searchTerm = q?.trim();
  const categoryId = category?.trim() || undefined;
  const stock: StockView = (STOCK_VIEWS as readonly string[]).includes(stockRaw ?? "") ? (stockRaw as StockView) : "all";

  const categories = organizationId ? await prisma.partCategory.findMany({ where: { organizationId }, orderBy: { name: "asc" } }) : [];
  const savedViewRows = organizationId
    ? await prisma.savedView.findMany({ where: { organizationId, resource: "inventory" }, orderBy: { createdAt: "asc" } })
    : [];

  // Everything below is one raw, fully-parameterized query family instead of
  // Prisma's normal query builder — "at or below reorder point" and "in
  // stock" compare two columns on the same row (quantityOnHand vs.
  // reorderPoint), which Prisma's where clause can't express at all. Doing
  // the whole list/count/view-counts through the same conditions here (not
  // a separate JS-side filter for one case and Prisma for another) keeps
  // every number on the page consistent with what's actually filtered.
  let parts: PartRow[] = [];
  let total = 0;
  let counts: StockCounts = { all: BigInt(0), in_stock: BigInt(0), low_stock: BigInt(0), out_of_stock: BigInt(0) };

  if (organizationId) {
    const baseConditions: Prisma.Sql[] = [Prisma.sql`p."organizationId" = ${organizationId}`];
    if (searchTerm) {
      baseConditions.push(Prisma.sql`(p."name" ILIKE ${`%${searchTerm}%`} OR p."sku" ILIKE ${`%${searchTerm}%`} OR p."barcode" ILIKE ${`%${searchTerm}%`})`);
    }
    if (categoryId) {
      baseConditions.push(Prisma.sql`p."categoryId" = ${categoryId}`);
    }
    const baseWhere = Prisma.join(baseConditions, " AND ");

    const stockCondition: Prisma.Sql | null =
      stock === "in"
        ? Prisma.sql`p."quantityOnHand" > p."reorderPoint"`
        : stock === "low"
          ? Prisma.sql`p."quantityOnHand" <= p."reorderPoint"`
          : stock === "out"
            ? Prisma.sql`p."quantityOnHand" = 0`
            : null;
    const listWhere = stockCondition ? Prisma.join([...baseConditions, stockCondition], " AND ") : baseWhere;

    const [partRows, totalRows, countRows] = await Promise.all([
      prisma.$queryRaw<PartRow[]>(Prisma.sql`
        SELECT p.id, p.name, p.sku, p."quantityOnHand"::int AS "quantityOnHand", p."reorderPoint"::int AS "reorderPoint",
          p."sellPrice"::text AS "sellPrice", pc.name AS "categoryName"
        FROM "Part" p
        LEFT JOIN "PartCategory" pc ON pc.id = p."categoryId"
        WHERE ${listWhere}
        ORDER BY p.name ASC
        LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
      `),
      prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT count(*)::bigint AS count FROM "Part" p WHERE ${listWhere}`),
      prisma.$queryRaw<StockCounts[]>(Prisma.sql`
        SELECT
          count(*)::bigint AS all,
          count(*) FILTER (WHERE p."quantityOnHand" > p."reorderPoint")::bigint AS in_stock,
          count(*) FILTER (WHERE p."quantityOnHand" <= p."reorderPoint")::bigint AS low_stock,
          count(*) FILTER (WHERE p."quantityOnHand" = 0)::bigint AS out_of_stock
        FROM "Part" p
        WHERE ${baseWhere}
      `),
    ]);

    parts = partRows;
    total = Number(totalRows[0]?.count ?? 0);
    counts = countRows[0] ?? counts;
  }

  const viewCount: Record<StockView, number> = {
    all: Number(counts.all),
    in: Number(counts.in_stock),
    low: Number(counts.low_stock),
    out: Number(counts.out_of_stock),
  };

  function viewHref(v: StockView) {
    const sp = new URLSearchParams();
    if (searchTerm) sp.set("q", searchTerm);
    if (categoryId) sp.set("category", categoryId);
    if (v !== "all") sp.set("stock", v);
    const qs = sp.toString();
    return qs ? `/inventory?${qs}` : "/inventory";
  }

  const savedViews: SavedViewItem[] = savedViewRows.map((v) => {
    let parsed: { q?: string; category?: string; stock?: string } = {};
    try {
      parsed = JSON.parse(v.filters);
    } catch {
      parsed = {};
    }
    const sp = new URLSearchParams();
    if (parsed.q) sp.set("q", parsed.q);
    if (parsed.category) sp.set("category", parsed.category);
    if (parsed.stock) sp.set("stock", parsed.stock);
    const qs = sp.toString();
    return {
      id: v.id,
      name: v.name,
      href: qs ? `/inventory?${qs}` : "/inventory",
      active: (parsed.q ?? "") === (searchTerm ?? "") && (parsed.category ?? "") === (categoryId ?? "") && (parsed.stock ?? "all") === stock,
    };
  });

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Inventory
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            What&apos;s on the shelf, and what needs reordering.
          </p>
        </div>
        <Link
          href="/inventory/new"
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition"
        >
          + New Part
        </Link>
      </div>

      {/* Smart views — always-current one-click filters, not a static count you have to go search for yourself */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STOCK_VIEWS.map((v) => {
          const active = v === stock;
          return (
            <Link
              key={v}
              href={viewHref(v)}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition"
              style={
                active
                  ? { background: "var(--color-brand-600)", color: "#fff" }
                  : { background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }
              }
            >
              {STOCK_VIEW_LABELS[v]} <span style={{ opacity: 0.8 }}>({viewCount[v].toLocaleString()})</span>
            </Link>
          );
        })}
      </div>

      <SavedViewsBar views={savedViews} currentFilters={{ q: searchTerm, category: categoryId, stock: stock !== "all" ? stock : undefined }} />

      <form method="GET" className="mb-4 flex flex-col sm:flex-row gap-3 max-w-2xl">
        {stock !== "all" && <input type="hidden" name="stock" value={stock} />}
        <div className="relative flex-1">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, SKU, or barcode…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
          />
        </div>
        <select
          name="category"
          defaultValue={categoryId ?? ""}
          className="px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white">
          Filter
        </button>
      </form>

      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table">
            <thead className="dt-head">
              <tr>
                <th className="dt-th text-left">Part</th>
                <th className="dt-th text-left">Category</th>
                <th className="dt-th text-left">SKU</th>
                <th className="dt-th text-left">On Hand</th>
                <th className="dt-th text-left">Sell Price</th>
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {parts.length === 0 && (
                <tr>
                  <td colSpan={6} className="dt-td text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    {q || categoryId || stock !== "all" ? (
                      "No parts match these filters."
                    ) : (
                      <>
                        No parts yet —{" "}
                        <Link href="/inventory/new" className="font-semibold text-brand-600">
                          add the first one
                        </Link>
                        .
                      </>
                    )}
                  </td>
                </tr>
              )}
              {parts.map((p) => {
                const isLowStock = p.quantityOnHand <= p.reorderPoint;
                return (
                  <tr key={p.id} className="dt-row group">
                    <td className="dt-td">
                      <Link href={`/inventory/${p.id}`} className="flex items-center gap-2 font-bold text-sm hover:underline" style={{ color: "var(--text-primary)" }}>
                        <InventoryIcon className="w-3.5 h-3.5 text-indigo-400" />
                        {p.name}
                      </Link>
                    </td>
                    <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
                      {p.categoryName ?? "—"}
                    </td>
                    <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
                      {p.sku ?? "—"}
                    </td>
                    <td className="dt-td num text-sm">
                      {isLowStock ? (
                        <span className="dt-badge dt-badge--error">
                          <span className="dt-badge-dot" />
                          {p.quantityOnHand}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-secondary)" }}>{p.quantityOnHand}</span>
                      )}
                    </td>
                    <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
                      {p.sellPrice ? `$${p.sellPrice}` : "—"}
                    </td>
                    <td className="dt-td text-right">
                      <div className="flex justify-end items-center gap-3">
                        <Link href={`/inventory/${p.id}/edit`} className="text-[11px] font-bold text-brand-600">
                          Edit
                        </Link>
                        <DeletePartButton partId={p.id} name={p.name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/inventory" params={{ q: searchTerm, category: categoryId, stock: stock !== "all" ? stock : undefined }} />
    </div>
  );
}
