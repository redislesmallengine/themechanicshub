import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersIcon, InventoryIcon, SearchIcon } from "@/components/icons";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const [customers, equipment] = organizationId && query
    ? await Promise.all([
        prisma.customer.findMany({
          where: {
            organizationId,
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 25,
          orderBy: { createdAt: "desc" },
        }),
        prisma.equipment.findMany({
          where: {
            organizationId,
            OR: [
              { serialNumber: { contains: query, mode: "insensitive" } },
              { make: { contains: query, mode: "insensitive" } },
              { model: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 25,
          orderBy: { createdAt: "desc" },
          include: { customer: true, equipmentType: true },
        }),
      ])
    : [[], []];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Search
        </h1>
        {query && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Results for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      <form method="GET" className="max-w-md">
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            name="q"
            defaultValue={query}
            autoFocus
            placeholder="Customers, phone/email, serial numbers…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
          />
        </div>
      </form>

      {!query ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Search across customers and equipment — by name, phone, email, or serial number.
        </p>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Customers ({customers.length})
            </h2>
            {customers.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No matching customers.
              </p>
            ) : (
              <div className="space-y-1.5">
                {customers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/customers/${c.id}`}
                    className="flex items-center gap-3 rounded-lg p-3 hover:shadow-sm transition"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                  >
                    <CustomersIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        {c.name}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact info"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Equipment ({equipment.length})
            </h2>
            {equipment.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No matching equipment.
              </p>
            ) : (
              <div className="space-y-1.5">
                {equipment.map((eq) => (
                  <Link
                    key={eq.id}
                    href={`/equipment/${eq.id}`}
                    className="flex items-center gap-3 rounded-lg p-3 hover:shadow-sm transition"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                  >
                    <InventoryIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        {[eq.make, eq.model].filter(Boolean).join(" ") || eq.equipmentType?.name || "Equipment"}
                        {eq.serialNumber ? ` — S/N ${eq.serialNumber}` : ""}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Owned by {eq.customer.name}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
