import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import { InviteIcon } from "@/components/icons";
import { RemoveMemberButton } from "@/components/remove-member-button";

// Matches the reference design's exact role-pill pattern (flat colored
// bg/text/border, no dot — distinct from the dt-badge/status-dot style used
// for work-order statuses elsewhere).
const ROLE_PILL: Record<RoleKey, string> = {
  owner: "bg-indigo-50 text-indigo-700 border-indigo-200",
  manager: "bg-blue-50 text-blue-700 border-blue-200",
  technician: "bg-emerald-50 text-emerald-700 border-emerald-200",
  bookkeeper: "bg-amber-50 text-amber-700 border-amber-200",
  frontdesk: "bg-slate-50 text-slate-700 border-slate-200",
};

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-extrabold text-lg" style={{ color: "var(--text-primary)" }}>
          Staff &amp; Roles
        </h1>
        <a
          href="/staff/invite"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-brand-600"
        >
          <InviteIcon className="w-4 h-4" />
          Invite Staff
        </a>
      </div>

      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table">
            <thead className="dt-head">
              <tr>
                <th className="dt-th w-10 text-center">
                  <input type="checkbox" className="rounded" style={{ accentColor: "#0F52BA" }} />
                </th>
                <th className="dt-th">Name</th>
                <th className="dt-th">Role</th>
                <th className="dt-th">Status</th>
                <th className="dt-th">Joined</th>
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.userId === session?.user.id;
                return (
                  <tr key={m.id} className="dt-row dt-row--status-good group">
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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${ROLE_PILL[m.role as RoleKey] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}>
                        {ROLE_LABELS[m.role as RoleKey] ?? m.role}
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
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
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
