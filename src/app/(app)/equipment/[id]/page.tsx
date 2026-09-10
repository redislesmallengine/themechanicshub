import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InventoryIcon } from "@/components/icons";
import { DeleteEquipmentButton } from "@/components/delete-equipment-button";

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

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const organizationId = session.session.activeOrganizationId;
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: { customer: true, equipmentType: true },
  });
  if (!equipment || equipment.organizationId !== organizationId) notFound();

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs mb-1">
          <Link href="/customers" className="font-semibold text-brand-600">
            Customers
          </Link>{" "}
          <span style={{ color: "var(--text-muted)" }}>/</span>{" "}
          <Link href={`/customers/${equipment.customer.id}`} className="font-semibold text-brand-600">
            {equipment.customer.name}
          </Link>
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {[equipment.make, equipment.model].filter(Boolean).join(" ") || equipment.equipmentType?.name || "Equipment"}
          </h1>
          <DeleteEquipmentButton equipmentId={equipment.id} label={[equipment.make, equipment.model].filter(Boolean).join(" ") || "this equipment"} />
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-start gap-5">
          <div
            className="w-28 h-28 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
            style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)" }}
          >
            {equipment.photoKey ? (
              // eslint-disable-next-line @next/next/no-img-element -- streamed via /api/equipment-photo
              <img src={`/api/equipment-photo/${equipment.id}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <InventoryIcon className="w-8 h-8 text-indigo-400" />
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
            <Field label="Type" value={equipment.equipmentType?.name} />
            <Field label="Make" value={equipment.make} />
            <Field label="Model" value={equipment.model} />
            <Field label="Serial Number" value={equipment.serialNumber} />
            <Field label="Engine Type" value={equipment.engineType} />
            <Field label="Displacement / HP" value={equipment.displacement} />
            <Field label="Year" value={equipment.year?.toString()} />
          </div>
        </div>

        {equipment.notes && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Intake Notes
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {equipment.notes}
            </p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Service History
        </h2>
        <div className="rounded-lg p-6 text-center text-sm" style={{ background: "var(--bg-surface-subtle)", border: "1px dashed var(--border-strong)", color: "var(--text-muted)" }}>
          No work orders yet — this fills in automatically once repairs start getting logged here.
        </div>
      </div>
    </div>
  );
}
