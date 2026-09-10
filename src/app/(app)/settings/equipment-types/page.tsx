import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EquipmentTypesManager } from "@/components/equipment-types-manager";

export default async function EquipmentTypesPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/dashboard");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) redirect("/dashboard");

  const organizationId = session.session.activeOrganizationId;
  const types = await prisma.equipmentType.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { equipment: true } } },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Equipment Types
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          What shows up in the Type dropdown when registering a customer&apos;s equipment — specific to your shop.
        </p>
      </div>

      <div className="max-w-2xl">
        <EquipmentTypesManager types={types.map((t) => ({ id: t.id, name: t.name, count: t._count.equipment }))} />
      </div>
    </div>
  );
}
