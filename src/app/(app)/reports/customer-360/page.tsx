import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersIcon, SearchIcon } from "@/components/icons";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 50;

/**
 * A reporting lens on the same customer data the Customers list shows, but
 * built for "how is this account doing" instead of day-to-day lookup —
 * work order activity and money owed up front, one click into the full
 * Customer 360 view (customers/[id], which carries the equipment/work
 * order/invoice/activity detail this list only summarizes).
 */
export default async function CustomerReportPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page: pageRaw } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const allowed = await auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { report: ["view"] } } });
  if (!allowed.success) redirect("/dashboard");

  const organizationId = session.session.activeOrganizationId;
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const searchTerm = q?.trim();

  const where = {
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
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { equipment: true } },
        workOrders: { select: { status: true } },
        invoices: { select: { status: true, total: true } },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.customer.count({ where }),
  ]);

  const rows = customers.map((c) => {
    const activeWorkOrders = c.workOrders.filter((wo) => wo.status !== "closed" && wo.status !== "declined").length;
    const totalInvoiced = c.invoices.filter((inv) => inv.status !== "void").reduce((sum, inv) => sum + Number(inv.total), 0);
    const outstanding = c.invoices.filter((inv) => inv.status === "sent" || inv.status === "viewed").reduce((sum, inv) => sum + Number(inv.total), 0);
    return { id: c.id, name: c.name, phone: c.phone, email: c.email, equipmentCount: c._count.equipment, workOrderCount: c.workOrders.length, activeWorkOrders, totalInvoiced, outstanding };
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Customer 360
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Every customer&apos;s activity and money owed at a glance — click through to a customer for their full equipment, work order, invoice, and activity history.
        </p>
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
                <th className="dt-th text-left">Equipment</th>
                <th className="dt-th text-left">Work Orders</th>
                <th className="dt-th text-left">Total Invoiced</th>
                <th className="dt-th text-left">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="dt-td text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    {q ? <>No customers match &ldquo;{q}&rdquo;.</> : <>No customers yet.</>}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="dt-row group">
                  <td className="dt-td">
                    <Link href={`/customers/${r.id}`} className="flex items-center gap-2 font-bold text-sm hover:underline" style={{ color: "var(--text-primary)" }}>
                      <CustomersIcon className="w-3.5 h-3.5 text-emerald-500" />
                      {r.name}
                    </Link>
                  </td>
                  <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
                    {r.equipmentCount}
                  </td>
                  <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
                    {r.workOrderCount}
                    {r.activeWorkOrders > 0 && (
                      <span className="ml-1.5 text-[11px] font-semibold" style={{ color: "var(--color-warning-text)" }}>
                        · {r.activeWorkOrders} active
                      </span>
                    )}
                  </td>
                  <td className="dt-td num text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    ${r.totalInvoiced.toFixed(2)}
                  </td>
                  <td className="dt-td num text-sm font-bold" style={{ color: r.outstanding > 0 ? "var(--color-error-solid)" : "var(--text-muted)" }}>
                    ${r.outstanding.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/reports/customer-360" params={{ q: searchTerm }} />
    </div>
  );
}
