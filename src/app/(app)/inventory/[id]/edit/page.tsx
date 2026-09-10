import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PartForm } from "@/components/part-form";
import { updatePart } from "@/app/(app)/inventory/actions";

export default async function EditPartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const organizationId = session.session.activeOrganizationId;
  const part = await prisma.part.findUnique({ where: { id } });
  if (!part || part.organizationId !== organizationId) notFound();

  const categories = await prisma.partCategory.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  const boundUpdate = updatePart.bind(null, id);

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-xs mb-1">
          <a href={`/inventory/${part.id}`} className="font-semibold text-brand-600">
            {part.name}
          </a>
        </p>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Edit Part
        </h1>
      </div>
      <div className="max-w-3xl">
        <PartForm
          mode="edit"
          categories={categories}
          initialCategoryId={part.categoryId ?? ""}
          initialName={part.name}
          initialSku={part.sku ?? ""}
          initialBarcode={part.barcode ?? ""}
          initialBinLocation={part.binLocation ?? ""}
          initialCostPrice={part.costPrice?.toString() ?? ""}
          initialSellPrice={part.sellPrice?.toString() ?? ""}
          initialReorderPoint={part.reorderPoint.toString()}
          initialNotes={part.notes ?? ""}
          cancelHref={`/inventory/${part.id}`}
          onSubmit={boundUpdate}
        />
      </div>
    </div>
  );
}
