import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InventoryIcon, SearchIcon } from "@/components/icons";
import { DeletePartButton } from "@/components/delete-part-button";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const parts = organizationId
    ? await prisma.part.findMany({
        where: {
          organizationId,
          ...(q?.trim()
            ? {
                OR: [
                  { name: { contains: q.trim(), mode: "insensitive" } },
                  { sku: { contains: q.trim(), mode: "insensitive" } },
                  { barcode: { contains: q.trim(), mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { name: "asc" },
        include: { category: true },
      })
    : [];

  const lowStockCount = parts.filter((p) => p.quantityOnHand <= p.reorderPoint).length;

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

      {lowStockCount > 0 && (
        <div
          className="mb-4 p-3 rounded-lg text-xs font-semibold max-w-md"
          style={{ background: "var(--color-error-subtle)", border: "1px solid var(--color-error-border)", color: "var(--color-error-text)" }}
        >
          {lowStockCount} part{lowStockCount === 1 ? "" : "s"} at or below reorder point.
        </div>
      )}

      <form method="GET" className="mb-4 max-w-md">
        <div className="relative">
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
                    {q ? (
                      <>No parts match &ldquo;{q}&rdquo;.</>
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
                      {p.category?.name ?? "—"}
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
                      {p.sellPrice ? `$${p.sellPrice.toString()}` : "—"}
                    </td>
                    <td className="dt-td text-right">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end items-center gap-3">
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
    </div>
  );
}
