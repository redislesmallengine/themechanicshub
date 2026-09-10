import { listRoles } from "@/lib/rbac";
import { AddUserForm } from "@/components/add-user-form";

export default async function AddUserPage() {
  const roles = await listRoles();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Add a Staff Member
        </h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Creates their login right away — no email required to get started.
        </p>
      </div>
      <div className="max-w-2xl">
        <AddUserForm roles={roles} />
      </div>
    </div>
  );
}
