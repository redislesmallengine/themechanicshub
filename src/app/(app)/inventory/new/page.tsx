import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PartForm } from "@/components/part-form";

export default async function NewPartPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const categories = await prisma.partCategory.findMany({
    where: { organizationId: session.session.activeOrganizationId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          New Part
        </h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Add it to the shelf.
        </p>
      </div>
      <div className="max-w-3xl">
        <PartForm categories={categories} />
      </div>
    </div>
  );
}
