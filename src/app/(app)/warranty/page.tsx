import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { now as getNow } from "@/lib/work-orders";
import { claimIsLate, claimStage, daysSince, summarizeClaims, CLAIM_REMINDER_DAYS } from "@/lib/warranty";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ClaimSteps } from "@/components/claim-steps";
import { MarkInvoiceSentButton } from "@/components/mark-invoice-sent-button";
import { MarkClaimPaid } from "@/components/mark-claim-paid";
import { ShieldIcon } from "@/components/icons";

const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const VIEWS = [
  { value: "open", label: "Not paid yet" },
  { value: "notSubmitted", label: "Not submitted" },
  { value: "submitted", label: "Submitted" },
  { value: "late", label: `Waiting ${CLAIM_REMINDER_DAYS}+ days` },
  { value: "paid", label: "Paid" },
  { value: "all", label: "All" },
] as const;
type View = (typeof VIEWS)[number]["value"];

export default async function WarrantyClaimsPage({ searchParams }: { searchParams: Promise<{ view?: string; provider?: string }> }) {
  const { view: viewRaw, provider: providerRaw } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;
  if (!session || !organizationId) redirect("/sign-in");

  const view: View = VIEWS.some((v) => v.value === viewRaw) ? (viewRaw as View) : "open";
  const nowMs = getNow();

  const [invoices, providers, canUpdate] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId, payerType: "warranty", status: { not: "void" } },
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { warrantyProvider: true, customer: true, equipment: { include: { equipmentType: true } } },
    }),
    prisma.warrantyProvider.findMany({ where: { organizationId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["update"] } } }),
  ]);

  const providerId = providerRaw && providers.some((p) => p.id === providerRaw) ? providerRaw : "";
  const forProvider = invoices.filter((i) => !providerId || i.warrantyProviderId === providerId);
  const summary = summarizeClaims(forProvider.map((i) => ({ status: i.status, total: Number(i.total), sentAt: i.sentAt })), nowMs);

  const shown = forProvider.filter((i) => {
    const stage = claimStage(i.status);
    switch (view) {
      case "open":
        return stage === "notSubmitted" || stage === "submitted";
      case "notSubmitted":
        return stage === "notSubmitted";
      case "submitted":
        return stage === "submitted";
      case "late":
        return claimIsLate(i.status, i.sentAt, nowMs);
      case "paid":
        return stage === "paid";
      default:
        return true;
    }
  });

  // Group by provider, biggest outstanding first.
  const groups = new Map<string, { name: string; email: string | null; claims: typeof shown }>();
  for (const inv of shown) {
    const key = inv.warrantyProviderId ?? "none";
    let g = groups.get(key);
    if (!g) {
      g = { name: inv.warrantyProvider?.name ?? "No warranty provider chosen", email: inv.warrantyProvider?.billingEmail ?? null, claims: [] };
      groups.set(key, g);
    }
    g.claims.push(inv);
  }
  const owing = (claims: typeof shown) => claims.filter((c) => claimStage(c.status) !== "paid").reduce((sum, c) => sum + Number(c.total), 0);
  const ordered = [...groups.values()].sort((a, b) => owing(b.claims) - owing(a.claims) || a.name.localeCompare(b.name));

  const hrefFor = (nextView: View) => {
    const sp = new URLSearchParams();
    if (nextView !== "open") sp.set("view", nextView);
    if (providerId) sp.set("provider", providerId);
    const qs = sp.toString();
    return qs ? `/warranty?${qs}` : "/warranty";
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <ShieldIcon className="w-5 h-5 text-sky-400" />
          Warranty Claims
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Every invoice billed to a manufacturer or warranty company, by provider: not submitted, submitted, paid.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Not submitted" value={money(summary.notSubmitted.amount)} sub={`${summary.notSubmitted.count} claim${summary.notSubmitted.count === 1 ? "" : "s"} to file`} href={hrefFor("notSubmitted")} tone={summary.notSubmitted.count > 0 ? "warning" : "neutral"} />
        <StatTile label="Submitted, waiting" value={money(summary.submitted.amount)} sub={`${summary.submitted.count} claim${summary.submitted.count === 1 ? "" : "s"}`} href={hrefFor("submitted")} />
        <StatTile label={`Waiting ${CLAIM_REMINDER_DAYS}+ days`} value={money(summary.late.amount)} sub={`${summary.late.count} claim${summary.late.count === 1 ? "" : "s"} to chase`} href={hrefFor("late")} tone={summary.late.count > 0 ? "error" : "neutral"} />
        <StatTile label="Paid" value={money(summary.paid.amount)} sub={`${summary.paid.count} claim${summary.paid.count === 1 ? "" : "s"}, all time`} href={hrefFor("paid")} tone="success" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => {
          const on = v.value === view;
          return (
            <Link
              key={v.value}
              href={hrefFor(v.value)}
              aria-current={on ? "true" : undefined}
              className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: on ? "var(--color-brand-600)" : "var(--bg-surface)", color: on ? "#fff" : "var(--text-secondary)", border: `1px solid ${on ? "var(--color-brand-600)" : "var(--border-strong)"}` }}
            >
              {v.label}
            </Link>
          );
        })}
        <form method="GET" className="flex items-center gap-2 ml-1">
          {view !== "open" && <input type="hidden" name="view" value={view} />}
          <label htmlFor="provider" className="sr-only">
            Provider
          </label>
          <select id="provider" name="provider" defaultValue={providerId} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}>
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}>
            Show
          </button>
        </form>
      </div>

      {ordered.length === 0 && (
        <div className="rounded-xl p-8 text-center text-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
          {invoices.length === 0 ? "No warranty claims yet. Make an invoice a warranty claim by choosing the provider under Invoice details." : "No claims in this view."}
        </div>
      )}

      {ordered.map((group) => (
        <section key={group.name} className="rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <header className="flex items-baseline justify-between gap-3 flex-wrap px-5 pt-4 pb-2">
            <div>
              <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {group.name}
              </h2>
              {group.email && (
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {group.email}
                </div>
              )}
            </div>
            <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              {group.claims.length} claim{group.claims.length === 1 ? "" : "s"} · owed {money(owing(group.claims))}
            </div>
          </header>
          <div className="dt-scroll">
            <table className="dt-table">
              <thead className="dt-head">
                <tr>
                  <th className="dt-th text-left">Invoice</th>
                  <th className="dt-th text-left">Customer · machine</th>
                  <th className="dt-th text-left">Claim #</th>
                  <th className="dt-th text-left">Steps</th>
                  <th className="dt-th text-right">Waiting</th>
                  <th className="dt-th text-right">Amount</th>
                  <th className="dt-th text-right">Next</th>
                </tr>
              </thead>
              <tbody>
                {group.claims.map((c) => {
                  const stage = claimStage(c.status);
                  const late = claimIsLate(c.status, c.sentAt, nowMs);
                  const waiting = stage === "submitted" ? daysSince(c.sentAt, nowMs) : null;
                  const machine = [c.equipment?.make, c.equipment?.model].filter(Boolean).join(" / ") || c.equipment?.equipmentType?.name || c.adHocEquipmentLabel || "";
                  return (
                    <tr key={c.id} className="dt-row" style={late ? { background: "var(--color-error-subtle)" } : undefined}>
                      <td className="dt-td">
                        <Link href={`/invoices/${c.id}`} className="font-bold text-sm hover:underline" style={{ color: "var(--text-primary)" }}>
                          {c.invoiceNumber}
                        </Link>
                      </td>
                      <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
                        {c.customer?.name ?? "—"}
                        {machine && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{machine}</div>}
                      </td>
                      <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
                        {c.claimNumber ?? "—"}
                      </td>
                      <td className="dt-td">
                        <ClaimSteps status={c.status} submittedAt={c.sentAt} paidAt={c.paidAt} compact />
                      </td>
                      <td className="dt-td num text-sm text-right" style={{ color: late ? "var(--color-error-text)" : "var(--text-muted)", fontWeight: late ? 700 : 500 }}>
                        {waiting === null ? "—" : `${waiting} day${waiting === 1 ? "" : "s"}`}
                      </td>
                      <td className="dt-td num text-sm text-right font-bold" style={{ color: "var(--text-primary)" }}>
                        {money(Number(c.total))}
                      </td>
                      <td className="dt-td text-right">
                        {!canUpdate.success ? null : stage === "notSubmitted" ? (
                          <MarkInvoiceSentButton invoiceId={c.id} warranty label="Mark submitted" className="px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60" />
                        ) : stage === "submitted" ? (
                          <MarkClaimPaid invoiceId={c.id} />
                        ) : (
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {c.paymentMethod ?? ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
