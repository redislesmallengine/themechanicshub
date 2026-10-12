import { prisma } from "@/lib/prisma";
import { requireSiteAdmin } from "@/lib/rbac";
import { ShopApprovalButtons } from "@/components/shop-approval-buttons";
import { ShieldIcon } from "@/components/icons";

const STATUS_BADGE = { pending: "warning", approved: "success", rejected: "error" } as const;
const STATUS_LABEL = { pending: "Waiting", approved: "Approved", rejected: "Rejected" } as const;
const ORDER = { pending: 0, rejected: 1, approved: 2 } as const;

export default async function ShopApprovalsPage() {
  await requireSiteAdmin();

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { members: { where: { role: "owner" }, include: { user: { select: { name: true, email: true } } }, take: 1 } },
  });
  const shops = organizations
    .map((o) => ({ ...o, status: (o.approvalStatus in ORDER ? o.approvalStatus : "pending") as keyof typeof ORDER }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const waiting = shops.filter((s) => s.status === "pending").length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <ShieldIcon className="w-5 h-5 text-brand-600" />
          Shop Approvals
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          New shops can&apos;t sign in until you approve them. {waiting > 0 ? `${waiting} waiting for a decision.` : "Nothing is waiting."}
        </p>
      </div>

      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table">
            <thead className="dt-head">
              <tr>
                <th className="dt-th text-left">Shop</th>
                <th className="dt-th text-left">Owner</th>
                <th className="dt-th text-left">Signed up</th>
                <th className="dt-th text-left">Status</th>
                <th className="dt-th text-right">Decision</th>
              </tr>
            </thead>
            <tbody>
              {shops.length === 0 && (
                <tr>
                  <td colSpan={5} className="dt-td text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    No shops yet.
                  </td>
                </tr>
              )}
              {shops.map((shop) => {
                const owner = shop.members[0]?.user;
                return (
                  <tr key={shop.id} className="dt-row">
                    <td className="dt-td font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                      {shop.name}
                    </td>
                    <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
                      {owner ? (
                        <>
                          {owner.name}
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {owner.email}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
                      {shop.createdAt.toLocaleDateString()}
                    </td>
                    <td className="dt-td">
                      <span className={`dt-badge dt-badge--${STATUS_BADGE[shop.status]}`}>
                        <span className="dt-badge-dot" />
                        {STATUS_LABEL[shop.status]}
                      </span>
                      {shop.status === "rejected" && shop.approvalNote && (
                        <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                          {shop.approvalNote}
                        </div>
                      )}
                    </td>
                    <td className="dt-td text-right">
                      <ShopApprovalButtons organizationId={shop.id} shopName={shop.name} status={shop.status} />
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
