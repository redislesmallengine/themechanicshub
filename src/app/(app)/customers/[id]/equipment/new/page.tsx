import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EquipmentForm } from "@/components/equipment-form";

export default async function NewEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const organizationId = session.session.activeOrganizationId;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer || customer.organizationId !== organizationId) notFound();

  const [equipmentTypes, equipmentMakes, engineTypes] = await Promise.all([
    prisma.equipmentType.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    prisma.equipmentMake.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    prisma.engineType.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Register Customer Equipment for {customer.name}
        </h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          <a href={`/customers/${customer.id}`} className="text-brand-600 font-semibold">
            {customer.name}
          </a>{" "}
          &rarr; New Customer Equipment
        </p>
      </div>
      <div className="max-w-3xl">
        <EquipmentForm customerId={customer.id} equipmentTypes={equipmentTypes} equipmentMakes={equipmentMakes} engineTypes={engineTypes} />
      </div>
    </div>
  );
}
