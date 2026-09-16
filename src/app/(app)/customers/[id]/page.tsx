import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersIcon } from "@/components/icons";
import { EquipmentMiniList } from "@/components/equipment-mini-list";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const organizationId = session.session.activeOrganizationId;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { equipment: { include: { equipmentType: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!customer || customer.organizationId !== organizationId) notFound();

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs mb-1">
          <Link href="/customers" className="font-semibold text-brand-600">
            Customers
          </Link>
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
              <CustomersIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                {customer.name}
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {[customer.phone, customer.email, customer.address].filter(Boolean).join(" · ") || "No contact info on file"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/customers/${customer.id}/edit`}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-slate-50"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
            >
              Edit
            </Link>
            <Link
              href={`/customers/${customer.id}/equipment/new`}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition"
            >
              + Add Equipment
            </Link>
          </div>
        </div>
      </div>

      {customer.notes && (
        <div className="rounded-lg p-3 text-xs max-w-2xl" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
          {customer.notes}
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Equipment ({customer.equipment.length})
        </h2>
        <EquipmentMiniList
          customerId={customer.id}
          showAddLink={false}
          equipment={customer.equipment.map((eq) => ({
            id: eq.id,
            label: [eq.make, eq.model].filter(Boolean).join(" / ") || eq.equipmentType?.name || "Unnamed equipment",
            typeName: eq.equipmentType?.name ?? null,
            serialNumber: eq.serialNumber,
            photoKey: eq.photoKey,
          }))}
        />
      </div>
    </div>
  );
}
