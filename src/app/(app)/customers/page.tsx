import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersIcon, SearchIcon } from "@/components/icons";
import { DeleteCustomerButton } from "@/components/delete-customer-button";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 50;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page: pageRaw } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const searchTerm = q?.trim();

  const where = organizationId
    ? {
        organizationId,
        ...(searchTerm
          ? {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" as const } },
                { phone: { contains: searchTerm, mode: "insensitive" as const } },
                { email: { contains: searchTerm, mode: "insensitive" as const } },
              ],
            }
          : {}),
      }
    : undefined;

  const [customers, total] = organizationId
    ? await Promise.all([
        prisma.customer.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { equipment: true } } },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        prisma.customer.count({ where }),
      ])
    : [[], 0];

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Customers
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Look up an existing customer by phone or email, or register a new one.
          </p>
        </div>
        <Link
          href="/customers/new"
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition"
        >
          + New Customer
        </Link>
      </div>

      <form method="GET" className="mb-4 max-w-md">
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, phone, or email…"
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
                <th className="dt-th text-left">Name</th>
                <th className="dt-th text-left">Phone</th>
                <th className="dt-th text-left">Email</th>
                <th className="dt-th text-left">Equipment</th>
                <th className="dt-th text-left">Added</th>
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="dt-td text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    {q ? (
                      <>No customers match &ldquo;{q}&rdquo;.</>
                    ) : (
                      <>
                        No customers yet —{" "}
                        <Link href="/customers/new" className="font-semibold text-brand-600">
                          register the first one
                        </Link>
                        .
                      </>
                    )}
                  </td>
                </tr>
              )}
              {customers.map((c) => (
                <tr key={c.id} className="dt-row group">
                  <td className="dt-td">
                    <Link href={`/customers/${c.id}`} className="flex items-center gap-2 font-bold text-sm hover:underline" style={{ color: "var(--text-primary)" }}>
                      <CustomersIcon className="w-3.5 h-3.5 text-emerald-500" />
                      {c.name}
                    </Link>
                  </td>
                  <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
                    {c.phone ?? "—"}
                  </td>
                  <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
                    {c.email ?? "—"}
                  </td>
                  <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
                    {c._count.equipment}
                  </td>
                  <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
                    {c.createdAt.toLocaleDateString()}
                  </td>
                  <td className="dt-td text-right">
                    <div className="flex justify-end items-center gap-3">
                      <Link href={`/customers/${c.id}/edit`} className="text-[11px] font-bold text-brand-600">
                        Edit
                      </Link>
                      <DeleteCustomerButton customerId={c.id} name={c.name} equipmentCount={c._count.equipment} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/customers" params={{ q: searchTerm }} />
    </div>
  );
}
