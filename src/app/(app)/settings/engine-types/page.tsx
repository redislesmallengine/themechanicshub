import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaxonomyManager } from "@/components/taxonomy-manager";
import { addEngineType, renameEngineType, deleteEngineType } from "./actions";

export default async function EngineTypesPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/dashboard");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) redirect("/dashboard");

  const organizationId = session.session.activeOrganizationId;
  const engineTypes = await prisma.engineType.findMany({ where: { organizationId }, orderBy: { name: "asc" } });

  const counts = await prisma.equipment.groupBy({
    by: ["engineType"],
    where: { organizationId, engineType: { in: engineTypes.map((e) => e.name) } },
    _count: { _all: true },
  });
  const countByName = new Map(counts.map((c) => [c.engineType, c._count._all]));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Engine Types
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          What shows up in the Engine Type dropdown when registering a customer&apos;s equipment — specific to your shop.
        </p>
      </div>

      <div className="max-w-2xl">
        <TaxonomyManager
          items={engineTypes.map((e) => ({ id: e.id, name: e.name, count: countByName.get(e.name) ?? 0 }))}
          itemNoun="Engine Type"
          addPlaceholder="e.g. Hybrid"
          onAdd={addEngineType}
          onRename={renameEngineType}
          onDelete={deleteEngineType}
        />
      </div>
    </div>
  );
}
