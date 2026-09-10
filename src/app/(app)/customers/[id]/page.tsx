import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersIcon, EquipmentIcon } from "@/components/icons";

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
                {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info on file"}
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

        {customer.equipment.length === 0 ? (
          <div className="rounded-lg p-6 text-center text-sm" style={{ background: "var(--bg-surface-subtle)", border: "1px dashed var(--border-strong)", color: "var(--text-muted)" }}>
            No equipment registered yet —{" "}
            <Link href={`/customers/${customer.id}/equipment/new`} className="font-semibold text-brand-600">
              add the first one
            </Link>
            .
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customer.equipment.map((eq) => (
              <Link
                key={eq.id}
                href={`/equipment/${eq.id}`}
                className="rounded-lg p-4 flex items-start gap-3 hover:shadow-md transition"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)" }}
                >
                  {eq.photoKey ? (
                    // eslint-disable-next-line @next/next/no-img-element -- streamed via /api/equipment-photo
                    <img src={`/api/equipment-photo/${eq.id}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <EquipmentIcon className="w-5 h-5 text-indigo-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                    {[eq.make, eq.model].filter(Boolean).join(" ") || eq.equipmentType?.name || "Unnamed equipment"}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {eq.equipmentType?.name ?? "Uncategorized"}
                    {eq.serialNumber ? ` · S/N ${eq.serialNumber}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
