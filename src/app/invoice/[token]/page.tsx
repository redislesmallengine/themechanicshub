import { prisma } from "@/lib/prisma";
import { WrenchIcon } from "@/components/icons";
import { STATUS_LABELS, STATUS_BADGE, isOverdue, type InvoiceStatus } from "@/lib/invoices";

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { viewToken: token },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      customer: true,
      equipment: { include: { equipmentType: true } },
      organization: { include: { shopProfile: true } },
    },
  });

  if (!invoice || invoice.status === "draft") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-app)" }}>
        <div className="w-full max-w-md rounded-xl p-8 md:p-10 text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}>
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 mb-4">
            <WrenchIcon className="w-4.5 h-4.5 text-white" />
          </span>
          <h1 className="text-xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>
            Link not valid
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            This invoice link doesn&apos;t exist, or hasn&apos;t been sent yet. Call the shop if you need anything.
          </p>
        </div>
      </div>
    );
  }

  // First open flips Sent -> Viewed — a customer who's already Paid/Void just keeps seeing the same read-only page, no status change.
  if (invoice.status === "sent") {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "viewed", viewedAt: new Date() } });
    invoice.status = "viewed";
  }

  const status = invoice.status as InvoiceStatus;
  const shopProfile = invoice.organization.shopProfile;
  const overdue = isOverdue(invoice.status, invoice.dueDate);
  const equipmentLabel = invoice.equipment
    ? [invoice.equipment.make, invoice.equipment.model].filter(Boolean).join(" ") || invoice.equipment.equipmentType?.name || "Equipment"
    : null;

  return (
    <div className="min-h-screen p-4 md:p-10 flex justify-center" style={{ background: "var(--bg-app)" }}>
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2.5 mb-6">
          {shopProfile?.logoKey ? (
            // eslint-disable-next-line @next/next/no-img-element -- streamed via /api/shop-logo
            <img src={`/api/shop-logo/${invoice.organizationId}`} alt="" className="w-9 h-9 rounded-lg object-contain" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }} />
          ) : (
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-600">
              <WrenchIcon className="w-4.5 h-4.5 text-white" />
            </span>
          )}
          <span className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
            {invoice.organization.name}
          </span>
        </div>

        <div className="rounded-xl p-6 md:p-8" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                Invoice {invoice.invoiceNumber}
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Issued {invoice.issueDate.toLocaleDateString()} · Due {invoice.dueDate.toLocaleDateString()}
              </p>
            </div>
            <span className={`dt-badge dt-badge--${overdue ? "error" : STATUS_BADGE[status]}`}>
              <span className="dt-badge-dot" />
              {overdue ? "Overdue" : STATUS_LABELS[status]}
            </span>
          </div>

          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                Bill To
              </div>
              {invoice.customer ? (
                <>
                  <p className="font-bold" style={{ color: "var(--text-primary)" }}>
                    {invoice.customer.name}
                  </p>
                  {invoice.customer.address && <p style={{ color: "var(--text-secondary)" }}>{invoice.customer.address}</p>}
                </>
              ) : (
                <p style={{ color: "var(--text-muted)" }}>No Customer Info</p>
              )}
            </div>
            {equipmentLabel && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                  Machine Details
                </div>
                <p className="font-bold" style={{ color: "var(--text-primary)" }}>
                  {equipmentLabel}
                </p>
                {invoice.equipment?.serialNumber && <p style={{ color: "var(--text-secondary)" }}>S/N {invoice.equipment.serialNumber}</p>}
                {invoice.equipment?.engineType && <p style={{ color: "var(--text-secondary)" }}>{invoice.equipment.engineType}</p>}
              </div>
            )}
          </div>

          <div className="dt-container mb-4">
            <div className="dt-scroll">
              <table className="dt-table">
                <thead className="dt-head">
                  <tr>
                    <th className="dt-th text-left">Description</th>
                    <th className="dt-th text-left">Qty</th>
                    <th className="dt-th text-left">Price</th>
                    <th className="dt-th text-left">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((line) => (
                    <tr key={line.id} className="dt-row">
                      <td className="dt-td text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {line.description}
                      </td>
                      <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
                        {line.quantity.toString()}
                      </td>
                      <td className="dt-td num text-sm" style={{ color: "var(--text-secondary)" }}>
                        ${line.unitPrice.toString()}
                      </td>
                      <td className="dt-td num text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        ${line.lineTotal.toString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-56 text-sm">
              <div className="flex justify-between py-1">
                <span style={{ color: "var(--text-muted)" }}>Subtotal</span>
                <span className="num" style={{ color: "var(--text-secondary)" }}>
                  ${invoice.subtotal.toString()}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span style={{ color: "var(--text-muted)" }}>
                  {shopProfile?.taxLabel ?? "Tax"} ({shopProfile?.taxRate?.toString() ?? "0"}%)
                </span>
                <span className="num" style={{ color: "var(--text-secondary)" }}>
                  ${invoice.taxAmount.toString()}
                </span>
              </div>
              <div className="flex justify-between py-2 mt-1 font-extrabold text-base" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-primary)" }}>Total</span>
                <span className="num" style={{ color: "var(--text-primary)" }}>
                  ${invoice.total.toString()}
                </span>
              </div>
            </div>
          </div>

          {status === "paid" && (
            <div className="mt-4 p-3 rounded-lg text-xs font-semibold" style={{ background: "var(--color-success-subtle)", border: "1px solid var(--color-success-border)", color: "var(--color-success-text)" }}>
              Paid {invoice.paidAt ? `on ${invoice.paidAt.toLocaleDateString()}` : ""} {invoice.paymentMethod ? `via ${invoice.paymentMethod}` : ""}
            </div>
          )}
          {status === "void" && (
            <div className="mt-4 p-3 rounded-lg text-xs font-semibold" style={{ background: "var(--color-error-subtle)", border: "1px solid var(--color-error-border)", color: "var(--color-error-text)" }}>
              This invoice has been voided.
            </div>
          )}

          {invoice.notes && (
            <div className="mt-4 pt-4 text-xs" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
              {invoice.notes}
            </div>
          )}

          <div className="mt-6 pt-4 flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3">
              {shopProfile?.facebookUrl && (
                <a href={shopProfile.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-600">
                  Find us on Facebook
                </a>
              )}
              {shopProfile?.googleReviewUrl && (
                <a
                  href={shopProfile.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700"
                >
                  Leave us a Google Review
                </a>
              )}
            </div>
            <a
              href={`/api/invoice/${token}/pdf`}
              className="px-4 py-2 rounded-lg text-xs font-semibold"
              style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
            >
              Download PDF
            </a>
          </div>

          {shopProfile?.hstNumber && (
            <p className="mt-4 text-center text-[10px]" style={{ color: "var(--text-muted)" }}>
              HST/GST #{shopProfile.hstNumber}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
