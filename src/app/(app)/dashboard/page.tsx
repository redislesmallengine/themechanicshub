// Work orders, invoices, and inventory don't exist yet (Phases 4-6) — this
// dashboard renders now so Phase 1's shell is real and navigable, with the
// same sample data used in the approved design preview, clearly labeled.
const SAMPLE_WORK_ORDERS = [
  {
    id: "WO-1042",
    customer: "Dave MacIsaac",
    phone: "902-555-0148",
    equipment: "Honda GCV160 — Mower",
    status: "warn" as const,
    label: "Awaiting Approval",
    updated: "2h ago",
  },
  {
    id: "WO-1041",
    customer: "Sarah Chiasson",
    phone: "902-555-0117",
    equipment: "Stihl MS 271 — Chainsaw",
    status: "info" as const,
    label: "In Repair",
    updated: "3h ago",
  },
  {
    id: "WO-1038",
    customer: "Roddy Gallant",
    phone: "902-555-0172",
    equipment: "Ariens Deluxe — Snowblower",
    status: "good" as const,
    label: "Ready for Pickup",
    updated: "1d ago",
  },
  {
    id: "WO-1031",
    customer: "Marguerite Arsenault",
    phone: "902-555-0163",
    equipment: "Honda EU2200i — Generator",
    status: "bad" as const,
    label: "Ready · 16 days",
    updated: "16d ago",
  },
];

const TILES = [
  { label: "On the Bench", value: "7", sub: "across 4 technicians" },
  { label: "Awaiting Approval", value: "3", sub: "1 waiting 2+ days", warn: true },
  { label: "Ready for Pickup", value: "5", sub: "2 over 14 days", warn: true },
  { label: "Unpaid Invoices", value: "$1,284", sub: "6 invoices" },
];

export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Dashboard
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Today&apos;s shop-floor snapshot for Red Isle Small Engine.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {TILES.map((t) => (
          <div
            key={t.label}
            className="rounded-lg p-4"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-xs)" }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
              {t.label}
            </div>
            <div className="text-2xl font-bold num" style={{ color: "var(--text-primary)" }}>
              {t.value}
            </div>
            <div className="text-xs mt-1" style={{ color: t.warn ? "var(--color-warning-solid)" : "var(--text-muted)", fontWeight: t.warn ? 600 : 400 }}>
              {t.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Today&apos;s Work Orders
        </h2>
        <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>
          Sample data — Work Orders module lands in Phase 4
        </span>
      </div>

      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table" style={{ minWidth: 640 }}>
            <thead className="dt-head">
              <tr>
                <th className="dt-th text-left">WO#</th>
                <th className="dt-th text-left">Customer</th>
                <th className="dt-th text-left">Equipment</th>
                <th className="dt-th text-left">Status</th>
                <th className="dt-th text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_WORK_ORDERS.map((wo) => (
                <tr key={wo.id} className="dt-row">
                  <td className="dt-td num" style={{ color: "var(--text-muted)" }}>
                    {wo.id}
                  </td>
                  <td className="dt-td">
                    <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                      {wo.customer}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {wo.phone}
                    </div>
                  </td>
                  <td className="dt-td text-sm">{wo.equipment}</td>
                  <td className="dt-td">
                    <span className={`dt-badge dt-badge--${wo.status === "warn" ? "warning" : wo.status === "bad" ? "error" : wo.status === "good" ? "success" : "info"}`}>
                      <span className="dt-badge-dot" />
                      {wo.label}
                    </span>
                  </td>
                  <td className="dt-td num text-sm text-right">{wo.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dt-footer">
          <span>Showing {SAMPLE_WORK_ORDERS.length} of 15 open work orders</span>
          <span className="num">Page 1 of 4</span>
        </div>
      </div>
    </div>
  );
}
