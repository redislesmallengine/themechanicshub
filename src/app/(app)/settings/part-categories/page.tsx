import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaxonomyManager } from "@/components/taxonomy-manager";
import { addPartCategory, renamePartCategory, deletePartCategory } from "./actions";

export default async function PartCategoriesPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/dashboard");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) redirect("/dashboard");

  const organizationId = session.session.activeOrganizationId;
  const categories = await prisma.partCategory.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { parts: true } } },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Part Categories
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          What shows up in the Category dropdown when adding a part — specific to your shop.
        </p>
      </div>

      <div className="max-w-2xl">
        <TaxonomyManager
          items={categories.map((c) => ({ id: c.id, name: c.name, count: c._count.parts }))}
          itemNoun="Category"
          addPlaceholder="e.g. Ignition Coils"
          onAdd={addPartCategory}
          onRename={renamePartCategory}
          onDelete={deletePartCategory}
        />
      </div>
    </div>
  );
}
