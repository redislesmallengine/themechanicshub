import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EquipmentIcon, SearchIcon } from "@/components/icons";
import { DeleteEquipmentButton } from "@/components/delete-equipment-button";
import { Pagination } from "@/components/pagination";
import { SortTh } from "@/components/sortable-th";
import { parseSort, sortQuery } from "@/lib/sort";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 50;
const SORT_FIELDS = ["model", "type", "serial", "customer", "added"] as const;

export default async function EquipmentListPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string; sort?: string; dir?: string }> }) {
  const { q, type, page: pageRaw, sort: sortRaw, dir: dirRaw } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const searchTerm = q?.trim();
  const typeId = type?.trim() || undefined;
  const sort = parseSort(sortRaw, dirRaw, SORT_FIELDS, { field: "added", dir: "desc" });
  const filterParams = { q: searchTerm, type: typeId };
  const orderBy: Prisma.EquipmentOrderByWithRelationInput[] = [
    ...(sort.field === "model"
      ? [{ make: { sort: sort.dir, nulls: "last" as const } }, { model: { sort: sort.dir, nulls: "last" as const } }]
      : sort.field === "type"
        ? [{ equipmentType: { name: sort.dir } }]
        : sort.field === "serial"
          ? [{ serialNumber: { sort: sort.dir, nulls: "last" as const } }]
          : sort.field === "customer"
            ? [{ customer: { name: sort.dir } }]
            : [{ createdAt: sort.dir }]),
    { id: "asc" },
  ];

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
          orderBy,
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
        {sort.explicit && sort.field && (
          <>
            <input type="hidden" name="sort" value={sort.field} />
            <input type="hidden" name="dir" value={sort.dir} />
          </>
        )}
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
                <SortTh label="Make/Model" field="model" sort={sort.field} dir={sort.dir} basePath="/equipment" params={filterParams} />
                <SortTh label="Type" field="type" sort={sort.field} dir={sort.dir} basePath="/equipment" params={filterParams} />
                <SortTh label="Serial Number" field="serial" sort={sort.field} dir={sort.dir} basePath="/equipment" params={filterParams} />
                <SortTh label="Customer" field="customer" sort={sort.field} dir={sort.dir} basePath="/equipment" params={filterParams} />
                <SortTh label="Added" field="added" sort={sort.field} dir={sort.dir} basePath="/equipment" params={filterParams} firstDir="desc" />
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
                        label={[eq.make, eq.model].filter(Boolean).join(" / ") || "this equipment"}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/equipment" params={{ ...filterParams, ...sortQuery(sort) }} />
    </div>
  );
}
