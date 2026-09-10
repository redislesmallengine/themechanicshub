import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSiteAdmin, OWNER_ROLE, countMembersWithRole } from "@/lib/rbac";
import { DeleteRoleButton } from "@/components/delete-role-button";
import { ShieldIcon } from "@/components/icons";

export default async function RolesAdminPage() {
  await requireSiteAdmin();

  const platformRoles = await prisma.platformRole.findMany({ orderBy: { createdAt: "asc" } });
  const memberCounts = await Promise.all(platformRoles.map((r) => countMembersWithRole(r.key)));
  const ownerCount = await countMembersWithRole("owner");

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <ShieldIcon className="w-5 h-5 text-brand-600" />
            Roles &amp; Rights
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Site administration — this role library is shared across every shop on the platform.
          </p>
        </div>
        <Link
          href="/admin/roles/new"
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition"
        >
          + New Role
        </Link>
      </div>

      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table">
            <thead className="dt-head">
              <tr>
                <th className="dt-th text-left">Role</th>
                <th className="dt-th text-left">Description</th>
                <th className="dt-th text-left">In Use</th>
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="dt-row">
                <td className="dt-td">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200">
                    {OWNER_ROLE.label}
                  </span>
                </td>
                <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
                  {OWNER_ROLE.description}
                </td>
                <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
                  {ownerCount}
                </td>
                <td className="dt-td text-right">
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                    Built in — can&apos;t be edited or deleted
                  </span>
                </td>
              </tr>
              {platformRoles.map((role, i) => (
                <tr key={role.key} className="dt-row group">
                  <td className="dt-td">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-slate-50 text-slate-700 border-slate-200">{role.label}</span>
                  </td>
                  <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
                    {role.description || "—"}
                  </td>
                  <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
                    {memberCounts[i]}
                  </td>
                  <td className="dt-td text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/admin/roles/${role.key}/edit`} className="text-[11px] font-bold text-brand-600">
                        Edit
                      </Link>
                      <DeleteRoleButton roleKey={role.key} label={role.label} inUse={memberCounts[i] > 0} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
