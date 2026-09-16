import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listRoles, roleMapFrom } from "@/lib/rbac";
import { InviteIcon } from "@/components/icons";
import { RemoveMemberButton } from "@/components/remove-member-button";

// Matches the reference design's exact role-pill pattern (flat colored
// bg/text/border, no dot — distinct from the dt-badge/status-dot style used
// for work-order statuses elsewhere). Roles are dynamic now (Site Admin →
// Roles), so the color comes from a fixed rotation keyed by role, not a
// hardcoded per-role map.
const ROLE_PILL_COLORS = [
  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-slate-50 text-slate-700 border-slate-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-sky-50 text-sky-700 border-sky-200",
];

function rolePillColor(roleKey: string) {
  if (roleKey === "owner") return ROLE_PILL_COLORS[0];
  let hash = 0;
  for (const ch of roleKey) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return ROLE_PILL_COLORS[1 + (hash % (ROLE_PILL_COLORS.length - 1))];
}

const AVATAR_COLORS = ["bg-brand-600", "bg-slate-700", "bg-emerald-600", "bg-amber-600"];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarColor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default async function StaffPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const { members } = await auth.api.listMembers({ headers: reqHeaders });
  const roleMap = roleMapFrom(await listRoles());

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Staff &amp; Roles
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Who has access to Red Isle Small Engine, and what they can do.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/staff/add"
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-slate-50"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
          >
            <InviteIcon className="w-3.5 h-3.5" />
            + Add User
          </a>
          <a
            href="/staff/invite"
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition"
          >
            <InviteIcon className="w-3.5 h-3.5" />
            + Invite Staff
          </a>
        </div>
      </div>

      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table">
            <thead className="dt-head">
              <tr>
                <th className="dt-th w-10 text-center">
                  <input type="checkbox" className="rounded" style={{ accentColor: "#0F52BA" }} />
                </th>
                <th className="dt-th text-left">Name</th>
                <th className="dt-th text-left">Role</th>
                <th className="dt-th text-left">Status</th>
                <th className="dt-th text-left">Joined</th>
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.userId === session?.user.id;
                return (
                  <tr key={m.id} className="dt-row group">
                    <td className="dt-td text-center">
                      <input type="checkbox" className="rounded" style={{ accentColor: "#0F52BA" }} />
                    </td>
                    <td className="dt-td">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full ${avatarColor(m.userId)} text-white font-bold text-xs flex items-center justify-center shrink-0`}
                        >
                          {initials(m.user?.name ?? "?")}
                        </div>
                        <div>
                          <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                            {m.user?.name ?? "—"} {isSelf && <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>(you)</span>}
                          </div>
                          <div className="text-[11px] num" style={{ color: "var(--text-muted)" }}>
                            {m.user?.email ?? "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="dt-td">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${rolePillColor(m.role)}`}>
                        {roleMap[m.role]?.label ?? m.role}
                      </span>
                    </td>
                    <td className="dt-td">
                      <span className="dt-badge dt-badge--success">
                        <span className="dt-badge-dot" />
                        Active
                      </span>
                    </td>
                    <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                    <td className="dt-td text-right">
                      {!isSelf && (
                        <div className="flex justify-end">
                          <RemoveMemberButton memberId={m.id} name={m.user?.name ?? "this person"} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
