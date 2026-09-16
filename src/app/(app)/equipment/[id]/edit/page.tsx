import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EquipmentEditForm } from "@/components/equipment-edit-form";

export default async function EditEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const organizationId = session.session.activeOrganizationId;
  const equipment = await prisma.equipment.findUnique({ where: { id }, include: { customer: true } });
  if (!equipment || equipment.organizationId !== organizationId) notFound();

  const [equipmentTypes, equipmentMakes, engineTypes] = await Promise.all([
    prisma.equipmentType.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    prisma.equipmentMake.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    prisma.engineType.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-xs mb-1">
          <a href={`/customers/${equipment.customer.id}`} className="font-semibold text-brand-600">
            {equipment.customer.name}
          </a>{" "}
          <span style={{ color: "var(--text-muted)" }}>/</span>{" "}
          <a href={`/equipment/${equipment.id}`} className="font-semibold text-brand-600">
            {[equipment.make, equipment.model].filter(Boolean).join(" / ") || "Equipment"}
          </a>
        </p>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Edit Customer Equipment
        </h1>
      </div>
      <div className="max-w-3xl">
        <EquipmentEditForm
          equipmentId={equipment.id}
          hasPhoto={!!equipment.photoKey}
          equipmentTypes={equipmentTypes}
          equipmentMakes={equipmentMakes}
          engineTypes={engineTypes}
          initialEquipmentTypeId={equipment.equipmentTypeId ?? ""}
          initialMake={equipment.make ?? ""}
          initialModel={equipment.model ?? ""}
          initialSerialNumber={equipment.serialNumber ?? ""}
          initialEngineType={equipment.engineType ?? ""}
          initialDisplacement={equipment.displacement ?? ""}
          initialYear={equipment.year?.toString() ?? ""}
          initialNotes={equipment.notes ?? ""}
        />
      </div>
    </div>
  );
}
