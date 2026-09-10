import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSiteAdmin } from "@/lib/rbac";
import { RoleForm } from "@/components/role-form";
import { updateRole } from "@/app/(app)/admin/roles/actions";

export default async function EditRolePage({ params }: { params: Promise<{ key: string }> }) {
  await requireSiteAdmin();
  const { key } = await params;

  if (key === "owner") redirect("/admin/roles"); // built in, never editable

  const role = await prisma.platformRole.findUnique({ where: { key } });
  if (!role) notFound();

  const boundUpdate = updateRole.bind(null, key);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Edit Role — {role.label}
        </h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Changes apply to every shop using this role immediately.
        </p>
      </div>
      <div className="max-w-3xl">
        <RoleForm
          mode="edit"
          initialLabel={role.label}
          initialDescription={role.description ?? ""}
          initialPermissions={role.permissions as Record<string, string[]>}
          onSubmit={boundUpdate}
        />
      </div>
    </div>
  );
}
