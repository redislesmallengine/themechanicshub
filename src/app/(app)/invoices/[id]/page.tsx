import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, STATUS_BADGE, INVOICE_TYPE_LABELS, INVOICE_TYPE_BADGE, isEditable, isOverdue, type InvoiceStatus, type InvoiceType } from "@/lib/invoices";
import { InvoiceLineItemsPanel } from "@/components/invoice-line-items-panel";
import { InvoiceStatusPanel } from "@/components/invoice-status-panel";
import { InvoiceDetailsForm } from "@/components/invoice-details-form";
import { InvoicePartyForm } from "@/components/invoice-party-form";
import { DeleteInvoiceButton } from "@/components/delete-invoice-button";
import { SendWhatsAppButton } from "@/components/send-whatsapp-button";
import { SentEmailsPanel } from "@/components/sent-emails-panel";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const organizationId = session.session.activeOrganizationId;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      customer: true,
      equipment: { include: { equipmentType: true } },
      workOrder: true,
      combinedWorkOrders: { include: { workOrder: { include: { equipment: { include: { equipmentType: true } } } } } },
      organization: { select: { name: true } },
    },
  });
  if (!invoice || invoice.organizationId !== organizationId) notFound();

  const [canUpdate, canVoid, canDelete, canViewMargins, availableParts, sentEmails, membership] = await Promise.all([
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["update"] } } }),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["void"] } } }),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["delete"] } } }),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["viewMargins"] } } }),
    prisma.part.findMany({ where: { organizationId, quantityOnHand: { gt: 0 } }, orderBy: { name: "asc" } }),
    prisma.sentEmail.findMany({ where: { relatedType: "invoice", relatedId: id }, orderBy: { createdAt: "desc" } }),
    prisma.member.findFirst({ where: { organizationId, userId: session.user.id } }),
  ]);
  const isOwner = membership?.role === "owner";

  const status = invoice.status as InvoiceStatus;
  const invoiceType = invoice.invoiceType as InvoiceType;
  const overdue = isOverdue(invoice.status, invoice.dueDate);
  const editable = isEditable(invoice.status) && canUpdate.success;
  const equipmentLabel = invoice.equipment
    ? [invoice.equipment.make, invoice.equipment.model].filter(Boolean).join(" / ") || invoice.equipment.equipmentType?.name || "Equipment"
    : invoice.adHocEquipmentLabel;
  const hasInventoryLines = invoice.lineItems.some((l) => !!l.partId);
  const canEditParty = editable && !invoice.workOrderId && invoice.combinedWorkOrders.length === 0;
  const pdfUrl = `${process.env.BETTER_AUTH_URL}/api/invoice/${invoice.viewToken}/pdf`;

  const partyCustomers = canEditParty
    ? await prisma.customer.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        include: { equipment: { include: { equipmentType: true } } },
      })
    : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs mb-1">
          <Link href="/invoices" className="font-semibold text-brand-600">
            Invoices
          </Link>
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`dt-badge dt-badge--${overdue ? "error" : STATUS_BADGE[status]}`}>
                <span className="dt-badge-dot" />
                {overdue ? "Overdue" : STATUS_LABELS[status]}
              </span>
              <span className={`dt-badge dt-badge--${INVOICE_TYPE_BADGE[invoiceType]}`}>
                <span className="dt-badge-dot" />
                {INVOICE_TYPE_LABELS[invoiceType]}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {invoice.invoiceNumber}
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {invoice.customer ? (
                <Link href={`/customers/${invoice.customer.id}`} className="text-brand-600 font-semibold">
                  {invoice.customer.name}
                </Link>
              ) : (
                <span className="font-semibold">No Customer Info</span>
              )}
              {invoice.workOrderId && (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/work-orders/${invoice.workOrderId}`} className="text-brand-600 font-semibold">
                    {equipmentLabel ?? "Work order"}
                  </Link>
                </>
              )}
              {invoice.combinedWorkOrders.length > 0 && (
                <>
                  {" "}
                  · <span className="font-semibold">Combined from {invoice.combinedWorkOrders.length} work orders</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-slate-50"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
            >
              Download PDF
            </a>
            <SendWhatsAppButton
              initialPhone={invoice.customer?.phone ?? null}
              customerName={invoice.customer?.name ?? null}
              invoiceNumber={invoice.invoiceNumber}
              shopName={invoice.organization.name}
              pdfUrl={pdfUrl}
            />
            {(status === "draft" || status === "void" || isOwner) && canDelete.success && (
              <DeleteInvoiceButton invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} status={status} hasInventoryLines={hasInventoryLines} redirectTo="/invoices" />
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Bill To
          </div>
          {invoice.customer ? (
            <>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {invoice.customer.name}
              </p>
              {invoice.customer.address && (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {invoice.customer.address}
                </p>
              )}
              {invoice.customer.phone && (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {invoice.customer.phone}
                </p>
              )}
              {invoice.customer.email && (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {invoice.customer.email}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No Customer Info
            </p>
          )}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            {invoice.combinedWorkOrders.length > 0 ? "Machines (combined invoice)" : "Machine Details"}
          </div>
          {invoice.combinedWorkOrders.length > 0 ? (
            <div className="space-y-1.5">
              {invoice.combinedWorkOrders.map((cwo) => {
                const eq = cwo.workOrder.equipment;
                const label = [eq.make, eq.model].filter(Boolean).join(" / ") || eq.equipmentType?.name || "Equipment";
                return (
                  <Link key={cwo.id} href={`/work-orders/${cwo.workOrder.id}`} className="block text-sm font-bold text-brand-600 hover:underline">
                    {label}
                  </Link>
                );
              })}
            </div>
          ) : invoice.equipment ? (
            <>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {equipmentLabel}
              </p>
              {invoice.equipment.serialNumber && (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  S/N {invoice.equipment.serialNumber}
                </p>
              )}
              {(invoice.equipment.engineType || invoice.equipment.displacement) && (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {[invoice.equipment.engineType, invoice.equipment.displacement].filter(Boolean).join(" · ")}
                </p>
              )}
              {invoice.equipment.year && (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {invoice.equipment.year}
                </p>
              )}
            </>
          ) : invoice.adHocEquipmentLabel ? (
            <>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {invoice.adHocEquipmentLabel}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Described directly — no equipment record on file.
              </p>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Parts only — no equipment attached.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Line Items
        </h2>
        <InvoiceLineItemsPanel
          invoiceId={invoice.id}
          editable={editable}
          showMargins={canViewMargins.success}
          lines={invoice.lineItems.map((l) => ({
            id: l.id,
            type: l.type,
            partId: l.partId,
            description: l.description,
            quantity: l.quantity.toString(),
            unitPrice: l.unitPrice.toString(),
            unitCost: l.unitCost?.toString() ?? null,
            taxable: l.taxable,
            lineTotal: l.lineTotal.toString(),
          }))}
          availableParts={availableParts.map((p) => ({ id: p.id, name: p.name, quantityOnHand: p.quantityOnHand, sellPrice: p.sellPrice?.toString() ?? null }))}
        />
        <div className="flex justify-end mt-4">
          <div className="w-56 text-sm">
            <div className="flex justify-between py-1">
              <span style={{ color: "var(--text-muted)" }}>Subtotal</span>
              <span className="num" style={{ color: "var(--text-secondary)" }}>
                ${invoice.subtotal.toString()}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span style={{ color: "var(--text-muted)" }}>Tax</span>
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
      </div>

      {canEditParty && (
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            Customer &amp; Equipment
          </h2>
          <InvoicePartyForm
            invoiceId={invoice.id}
            customers={partyCustomers.map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              email: c.email,
              equipment: c.equipment.map((eq) => ({
                id: eq.id,
                label: [eq.make, eq.model].filter(Boolean).join(" / ") || eq.equipmentType?.name || (eq.serialNumber ? `S/N ${eq.serialNumber}` : "Unnamed equipment"),
              })),
            }))}
            initialCustomerId={invoice.customerId ?? ""}
            initialEquipmentId={invoice.equipmentId ?? ""}
            initialAdHocEquipmentLabel={invoice.adHocEquipmentLabel ?? ""}
          />
        </div>
      )}

      {editable && (
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            Details
          </h2>
          <InvoiceDetailsForm invoiceId={invoice.id} initialDueDate={invoice.dueDate.toISOString().slice(0, 10)} initialNotes={invoice.notes ?? ""} />
        </div>
      )}

      {invoice.notes && !editable && (
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Notes
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {invoice.notes}
          </p>
        </div>
      )}

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Status
        </h2>
        <InvoiceStatusPanel invoiceId={invoice.id} status={invoice.status} hasCustomer={!!invoice.customer} hasCustomerEmail={!!invoice.customer?.email} canVoid={canVoid.success} />
        {invoice.status === "paid" && invoice.paymentReference && (
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Reference: {invoice.paymentReference}
          </p>
        )}
        {invoice.status === "void" && invoice.voidReason && (
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Reason: {invoice.voidReason}
          </p>
        )}
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Emails Sent
        </h2>
        <SentEmailsPanel
          emails={sentEmails.map((e) => ({
            id: e.id,
            to: e.to,
            subject: e.subject,
            html: e.html,
            success: e.success,
            provider: e.provider,
            errorMessage: e.errorMessage,
            createdAt: e.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
