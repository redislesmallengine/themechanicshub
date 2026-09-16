import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EquipmentIcon, SearchIcon } from "@/components/icons";
import { DeleteEquipmentButton } from "@/components/delete-equipment-button";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 50;

export default async function EquipmentListPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string }> }) {
  const { q, type, page: pageRaw } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const searchTerm = q?.trim();
  const typeId = type?.trim() || undefined;

  const equipmentTypes = organizationId ? await prisma.equipmentType.findMany({ where: { organizationId }, orderBy: { name: "asc" } }) : [];

  const where = organizationId
    ? {
        organizationId,
        ...(typeId ? { equipmentTypeId: typeId } : {}),
        ...(searchTerm
          ? {
              OR: [
                { make: { contains: searchTerm, mode: "insensitive" as const } },
                { model: { contains: searchTerm, mode: "insensitive" as const } },
                { serialNumber: { contains: searchTerm, mode: "insensitive" as const } },
                { customer: { name: { contains: searchTerm, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      }
    : undefined;

  const [equipment, total] = organizationId
    ? await Promise.all([
        prisma.equipment.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: { customer: true, equipmentType: true },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        prisma.equipment.count({ where }),
      ])
    : [[], 0];

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Customer Equipment
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Every piece of equipment registered across all customers.
          </p>
        </div>
      </div>

      <form method="GET" className="mb-4 flex flex-col sm:flex-row gap-3 max-w-2xl">
        <div className="relative flex-1">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by make, model, serial number, or customer…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
          />
        </div>
        <select
          name="type"
          defaultValue={typeId ?? ""}
          className="px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
        >
          <option value="">All Types</option>
          {equipmentTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
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
                <th className="dt-th text-left">Make/Model</th>
                <th className="dt-th text-left">Type</th>
                <th className="dt-th text-left">Serial Number</th>
                <th className="dt-th text-left">Customer</th>
                <th className="dt-th text-left">Added</th>
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {equipment.length === 0 && (
                <tr>
                  <td colSpan={6} className="dt-td text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    {q || typeId ? (
                      <>No equipment matches these filters.</>
                    ) : (
                      <>
                        No equipment registered yet — start from a{" "}
                        <Link href="/customers" className="font-semibold text-brand-600">
                          customer&apos;s page
                        </Link>
                        .
                      </>
                    )}
                  </td>
                </tr>
              )}
              {equipment.map((eq) => (
                <tr key={eq.id} className="dt-row group">
                  <td className="dt-td">
                    <Link href={`/equipment/${eq.id}`} className="flex items-center gap-3 hover:underline">
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 overflow-hidden"
                        style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)" }}
                      >
                        {eq.photoKey ? (
                          // eslint-disable-next-line @next/next/no-img-element -- streamed via /api/equipment-photo
                          <img src={`/api/equipment-photo/${eq.id}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <EquipmentIcon className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                      </div>
                      <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        {[eq.make, eq.model].filter(Boolean).join(" / ") || "Unnamed equipment"}
                      </span>
                    </Link>
                  </td>
                  <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
                    {eq.equipmentType?.name ?? "—"}
                  </td>
                  <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
                    {eq.serialNumber ?? "—"}
                  </td>
                  <td className="dt-td text-sm">
                    <Link href={`/customers/${eq.customer.id}`} className="font-semibold text-brand-600 hover:underline">
                      {eq.customer.name}
                    </Link>
                  </td>
                  <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
                    {eq.createdAt.toLocaleDateString()}
                  </td>
                  <td className="dt-td text-right">
                    <div className="flex justify-end items-center gap-3">
                      <Link href={`/equipment/${eq.id}/edit`} className="text-[11px] font-bold text-brand-600">
                        Edit
                      </Link>
                      <DeleteEquipmentButton
                        equipmentId={eq.id}
                        label={[eq.make, eq.model].filter(Boolean).join(" ") || "this equipment"}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/equipment" params={{ q: searchTerm, type: typeId }} />
    </div>
  );
}
