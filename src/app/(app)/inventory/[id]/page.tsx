import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InventoryIcon } from "@/components/icons";
import { AdjustStockForm } from "@/components/adjust-stock-form";
import { DeletePartButton } from "@/components/delete-part-button";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-sm font-medium" style={{ color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
        {value || "—"}
      </div>
    </div>
  );
}

export default async function PartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const organizationId = session.session.activeOrganizationId;
  const part = await prisma.part.findUnique({
    where: { id },
    include: { category: true, adjustments: { orderBy: { createdAt: "desc" }, take: 25, include: { createdBy: true } } },
  });
  if (!part || part.organizationId !== organizationId) notFound();

  const isLowStock = part.quantityOnHand <= part.reorderPoint;

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs mb-1">
          <Link href="/inventory" className="font-semibold text-brand-600">
            Inventory
          </Link>
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
              <InventoryIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                {part.name}
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {part.category?.name ?? "Uncategorized"}
                {part.sku ? ` · SKU ${part.sku}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/inventory/${part.id}/edit`}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-slate-50"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
            >
              Edit
            </Link>
            <DeletePartButton partId={part.id} name={part.name} redirectTo="/inventory" />
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>
              Quantity on Hand
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold num" style={{ color: isLowStock ? "var(--color-error-solid)" : "var(--text-primary)" }}>
                {part.quantityOnHand}
              </span>
              {isLowStock && (
                <span className="dt-badge dt-badge--error">
                  <span className="dt-badge-dot" />
                  Low
                </span>
              )}
            </div>
          </div>
          <Field label="Reorder Point" value={part.reorderPoint.toString()} />
          <Field label="Cost Price" value={part.costPrice ? `$${part.costPrice.toString()}` : null} />
          <Field label="Sell Price" value={part.sellPrice ? `$${part.sellPrice.toString()}` : null} />
          <Field label="Barcode" value={part.barcode} />
          <Field label="Bin Location" value={part.binLocation} />
        </div>
        {part.notes && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Notes
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {part.notes}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Adjust Stock
        </h2>
        <AdjustStockForm
          partId={part.id}
          currentQuantity={part.quantityOnHand}
          currentCostPrice={part.costPrice?.toString() ?? null}
          currentSellPrice={part.sellPrice?.toString() ?? null}
        />
      </div>

      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Stock History
        </h2>
        {part.adjustments.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No adjustments logged yet.
          </p>
        ) : (
          <div className="dt-container">
            <div className="dt-scroll">
              <table className="dt-table">
                <thead className="dt-head">
                  <tr>
                    <th className="dt-th text-left">Date</th>
                    <th className="dt-th text-left">Change</th>
                    <th className="dt-th text-left">Reason</th>
                    <th className="dt-th text-left">Note</th>
                    <th className="dt-th text-left">By</th>
                  </tr>
                </thead>
                <tbody>
                  {part.adjustments.map((adj) => (
                    <tr key={adj.id} className="dt-row">
                      <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
                        {adj.createdAt.toLocaleString()}
                      </td>
                      <td className="dt-td num text-sm font-bold" style={{ color: adj.delta > 0 ? "var(--color-success-solid)" : "var(--color-error-solid)" }}>
                        {adj.delta > 0 ? `+${adj.delta}` : adj.delta}
                      </td>
                      <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
                        {adj.reason}
                      </td>
                      <td className="dt-td text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                        {adj.note ?? "—"}
                      </td>
                      <td className="dt-td text-sm" style={{ color: "var(--text-muted)" }}>
                        {adj.createdBy?.name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
