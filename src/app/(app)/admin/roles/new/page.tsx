"use client";

import { RoleForm } from "@/components/role-form";
import { createRole } from "@/app/(app)/admin/roles/actions";

export default function NewRolePage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          New Role
        </h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Available to every shop on the platform as soon as you save it.
        </p>
      </div>
      <div className="max-w-3xl">
        <RoleForm mode="create" onSubmit={createRole} />
      </div>
    </div>
  );
}
