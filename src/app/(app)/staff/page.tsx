import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import { InviteIcon } from "@/components/icons";

export default async function StaffPage() {
  const reqHeaders = await headers();
  const { members } = await auth.api.listMembers({ headers: reqHeaders });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-extrabold text-lg" style={{ color: "var(--text-primary)" }}>
          Staff &amp; Roles
        </h1>
        <Link
          href="/staff/invite"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-brand-600"
        >
          <InviteIcon className="w-4 h-4" />
          Invite Staff
        </Link>
      </div>

      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table">
            <thead className="dt-head">
              <tr>
                <th className="dt-th">Name</th>
                <th className="dt-th">Email</th>
                <th className="dt-th">Role</th>
                <th className="dt-th">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="dt-row">
                  <td className="dt-td font-semibold text-sm">{m.user?.name ?? "—"}</td>
                  <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
                    {m.user?.email ?? "—"}
                  </td>
                  <td className="dt-td">
                    <span className="dt-badge dt-badge--info">
                      <span className="dt-badge-dot" />
                      {ROLE_LABELS[m.role as RoleKey] ?? m.role}
                    </span>
                  </td>
                  <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
                    {new Date(m.createdAt).toLocaleDateString()}
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
