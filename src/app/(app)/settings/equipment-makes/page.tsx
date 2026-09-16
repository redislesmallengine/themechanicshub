import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaxonomyManager } from "@/components/taxonomy-manager";
import { addEquipmentMake, renameEquipmentMake, deleteEquipmentMake } from "./actions";

export default async function EquipmentMakesPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/dashboard");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) redirect("/dashboard");

  const organizationId = session.session.activeOrganizationId;
  const makes = await prisma.equipmentMake.findMany({ where: { organizationId }, orderBy: { name: "asc" } });

  // Equipment.make is a plain string column (see schema comment on
  // EquipmentMake), so "how many equipment use this" is a string-match
  // count against it rather than a relation's _count -- same number, same
  // delete-guard behavior as Equipment Types, just computed differently.
  const counts = await prisma.equipment.groupBy({
    by: ["make"],
    where: { organizationId, make: { in: makes.map((m) => m.name) } },
    _count: { _all: true },
  });
  const countByName = new Map(counts.map((c) => [c.make, c._count._all]));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Equipment Makes
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          What shows up in the Make dropdown when registering a customer&apos;s equipment — specific to your shop.
        </p>
      </div>

      <div className="max-w-2xl">
        <TaxonomyManager
          items={makes.map((m) => ({ id: m.id, name: m.name, count: countByName.get(m.name) ?? 0 }))}
          itemNoun="Make"
          addPlaceholder="e.g. Kawasaki"
          onAdd={addEquipmentMake}
          onRename={renameEquipmentMake}
          onDelete={deleteEquipmentMake}
        />
      </div>
    </div>
  );
}
