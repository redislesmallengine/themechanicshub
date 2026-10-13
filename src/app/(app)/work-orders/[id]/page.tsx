import Link from "next/link";
import { PhoneLink, CallButton } from "@/components/phone-link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, STATUS_BADGE, DROP_OFF_METHOD_LABELS, type WorkOrderStatus } from "@/lib/work-orders";
import { invoiceChip } from "@/lib/invoices";
import { MarkInvoiceSentButton } from "@/components/mark-invoice-sent-button";
import { WorkOrderStatusPanel } from "@/components/work-order-status-panel";
import { WorkOrderDiagnosisForm } from "@/components/work-order-diagnosis-form";
import { WorkOrderPartsPanel } from "@/components/work-order-parts-panel";
import { GenerateInvoiceButton } from "@/components/generate-invoice-button";
import { SentEmailsPanel } from "@/components/sent-emails-panel";
import { DeleteWorkOrderButton } from "@/components/delete-work-order-button";

// A card that starts folded, for the parts of a job that matter less once the next step is on screen.
function Collapsible({ title, summary, defaultOpen = false, children }: { title: string; summary?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3">
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          ▸ {title}
        </span>
        {summary && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {summary}
          </span>
        )}
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
import { WorkOrderRepairNotesForm } from "@/components/work-order-repair-notes-form";
import { WorkOrderStatusMover } from "@/components/work-order-status-mover";
import { FinishJobPanel } from "@/components/finish-job-panel";
import { InvoiceStatusPanel } from "@/components/invoice-status-panel";

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const organizationId = session.session.activeOrganizationId;
  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      equipment: { include: { equipmentType: true } },
      assignedTo: true,
      parts: { orderBy: { createdAt: "asc" } },
      invoice: { include: { warrantyProvider: true } },
      combinedInto: { include: { invoice: { include: { warrantyProvider: true } } } },
    },
  });
  if (!workOrder || workOrder.organizationId !== organizationId) notFound();

  const [{ members }, availableParts, shopProfile, sentEmails, canDelete, membership, services, canVoid] = await Promise.all([
    auth.api.listMembers({ headers: reqHeaders }),
    prisma.part.findMany({ where: { organizationId, quantityOnHand: { gt: 0 } }, orderBy: { name: "asc" } }),
    prisma.shopProfile.findUnique({ where: { organizationId } }),
    prisma.sentEmail.findMany({ where: { relatedType: "estimate", relatedId: workOrder.id }, orderBy: { createdAt: "desc" } }),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { workOrder: ["delete"] } } }),
    prisma.member.findFirst({ where: { organizationId, userId: session.user.id } }),
    prisma.service.findMany({ where: { organizationId, active: true }, orderBy: { name: "asc" } }),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["void"] } } }),
  ]);
  const isOwner = membership?.role === "owner";

  const status = workOrder.status as WorkOrderStatus;
  // The money side of this job, in plain words, so the job and its invoice are never read as contradicting each other.
  const linkedInvoice = workOrder.invoice ?? workOrder.combinedInto?.invoice ?? null;
  const draftInvoiceId = linkedInvoice?.status === "draft" ? linkedInvoice.id : null;
  const moneyChip = linkedInvoice ? invoiceChip(linkedInvoice.status, linkedInvoice.dueDate, linkedInvoice.payerType) : null;
  const jobIsDone = status === "readyForPickup" || status === "closed";
  // Not billed yet and ready for it: the Finish panel is this job's next step.
  const showFinish = (status === "inRepair" || status === "readyForPickup") && !linkedInvoice;
  const equipmentLabel = [workOrder.equipment.make, workOrder.equipment.model].filter(Boolean).join(" / ") || workOrder.equipment.equipmentType?.name || "Equipment";
  // The option shows whenever this work order was marked Shop
  // Pickup/Delivery at intake -- independent of whether Shop Profile has a
  // default amount, so a shop that hasn't set one yet still gets prompted
  // and can just type the amount in. The default only controls what the
  // field starts pre-filled with.
  const showDeliveryFee = workOrder.dropOffMethod === "pickupDelivery";
  const deliveryFeeDefault = shopProfile?.deliveryFee?.toString() ?? "";

  // Pending / Diagnosing: the Diagnosis form comes first -- it is where the next move
  // (send an estimate, repair later, start repair) is chosen. Later on it drops below Status.
  const earlyStage = status === "droppedOff" || status === "diagnosing";
  const diagnosisForm = (
    <WorkOrderDiagnosisForm
      workOrderId={workOrder.id}
      status={status}
      preApprovalRequired={workOrder.preApprovalRequired}
      members={members.filter((m) => m.user).map((m) => ({ userId: m.userId, name: m.user!.name }))}
      currentUserId={session.user.id}
      initialDiagnosisNotes={workOrder.diagnosisNotes ?? ""}
      initialLabourHours={workOrder.labourHours?.toString() ?? ""}
      initialAssignedToUserId={workOrder.assignedToUserId ?? ""}
    />
  );
  const diagnosisCard = (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
        Diagnosis
      </h2>
      {diagnosisForm}
    </div>
  );

  // "The story so far" -- problem (the complaint card above), diagnosis, what the
  // customer was told, and how it was fixed, together once work is underway.
  const showStory = status === "inRepair" || status === "readyForPickup" || status === "closed";
  const approvalMethodText = workOrder.approvalMethod === "phone" ? "by phone" : workOrder.approvalMethod === "in-person" ? "in person" : "through the online link";
  const toldCustomer = workOrder.estimateAmount
    ? `$${workOrder.estimateAmount.toString()} — ${workOrder.estimateNotes ?? ""}${workOrder.decidedByName ? ` Approved by ${workOrder.decidedByName} ${approvalMethodText} on ${workOrder.decidedAt?.toLocaleDateString() ?? ""}.` : ""}`
    : workOrder.decidedByName
      ? `No written estimate — go-ahead given ${approvalMethodText} by ${workOrder.decidedByName} on ${workOrder.decidedAt?.toLocaleDateString() ?? ""}.${workOrder.notToExceedAmount ? ` Not to exceed $${workOrder.notToExceedAmount.toString()}.` : ""}`
      : "—";
  const diagnosisSub = [workOrder.assignedTo?.name, workOrder.labourHours ? `${workOrder.labourHours.toString()} hr` : null].filter(Boolean).join(" · ");

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs mb-1">
          <Link href="/work-orders" className="font-semibold text-brand-600">
            Work Orders
          </Link>
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`dt-badge dt-badge--${STATUS_BADGE[status]}`}>
                <span className="dt-badge-dot" />
                {STATUS_LABELS[status]}
              </span>
              {moneyChip && linkedInvoice ? (
                <Link href={`/invoices/${linkedInvoice.id}`} className={`dt-badge dt-badge--${moneyChip.badge}`} title="Open the invoice">
                  <span className="dt-badge-dot" />
                  Invoice: {moneyChip.label}
                </Link>
              ) : (
                jobIsDone && (
                  <span className="dt-badge dt-badge--warning">
                    <span className="dt-badge-dot" />
                    Invoice: none yet
                  </span>
                )
              )}
              {workOrder.dropOffMethod === "pickupDelivery" && (
                <span className="dt-badge dt-badge--info">
                  <span className="dt-badge-dot" />
                  {DROP_OFF_METHOD_LABELS.pickupDelivery}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {equipmentLabel}
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              <Link href={`/customers/${workOrder.customer.id}`} className="text-brand-600 font-semibold">
                {workOrder.customer.name}
              </Link>{" "}
              ·{" "}
              <Link href={`/equipment/${workOrder.equipment.id}`} className="text-brand-600 font-semibold">
                View equipment
              </Link>
              {workOrder.customer.phone && (
                <>
                  {" "}
                  · <PhoneLink phone={workOrder.customer.phone} />
                </>
              )}
              {workOrder.assignedTo && (
                <>
                  {" "}
                  · Technician: <b style={{ color: "var(--text-secondary)" }}>{workOrder.assignedTo.name}</b>
                </>
              )}
            </p>
          </div>
          <CallButton phone={workOrder.customer.phone} name={workOrder.customer.name} />
          {(status === "droppedOff" || status === "declined" || isOwner) && !workOrder.invoice && !workOrder.combinedInto && canDelete.success && (
            <DeleteWorkOrderButton
              workOrderId={workOrder.id}
              equipmentLabel={equipmentLabel}
              status={status}
              hasInventoryLines={workOrder.parts.length > 0}
              redirectTo="/work-orders"
            />
          )}
        </div>
      </div>

      {jobIsDone && draftInvoiceId && linkedInvoice && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap" style={{ background: "var(--color-warning-subtle)", border: "1px solid var(--color-warning-border)" }}>
          <p className="text-sm font-semibold flex-1 min-w-[14rem]" style={{ color: "var(--color-warning-text)" }}>
            This job is {status === "closed" ? "picked up" : "ready for pickup"}, but its invoice ({linkedInvoice.invoiceNumber}) is still a draft.
          </p>
          <MarkInvoiceSentButton invoiceId={draftInvoiceId} warranty={linkedInvoice.payerType === "warranty"} />
          <Link href={`/invoices/${draftInvoiceId}`} className="text-xs font-bold text-brand-600">
            Open the invoice
          </Link>
        </div>
      )}
      {status === "readyForPickup" && !linkedInvoice && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap" style={{ background: "var(--color-warning-subtle)", border: "1px solid var(--color-warning-border)" }}>
          <p className="text-sm font-semibold flex-1 min-w-[14rem]" style={{ color: "var(--color-warning-text)" }}>
            This job is ready for pickup, but there is no invoice yet.
          </p>
          <a href="#invoice-card" className="text-xs font-bold text-brand-600">
            Go to Invoice
          </a>
        </div>
      )}

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
          Complaint
        </div>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {workOrder.complaint}
        </p>
      </div>

      {earlyStage && diagnosisCard}

      {/* Billed: the invoice is the next step, with sending and payment right here. */}
      {linkedInvoice && (
        <div id="invoice-card" className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "2px solid var(--color-brand-600)" }}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Invoice {linkedInvoice.invoiceNumber} · ${linkedInvoice.total.toString()}
              {workOrder.combinedInto && (
                <span className="ml-2 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                  combined with other equipment
                </span>
              )}
            </h2>
            <Link href={`/invoices/${linkedInvoice.id}`} className="text-xs font-bold text-brand-600">
              Open the full invoice →
            </Link>
          </div>
          <InvoiceStatusPanel
            invoiceId={linkedInvoice.id}
            status={linkedInvoice.status}
            isWarranty={linkedInvoice.payerType === "warranty"}
            hasRecipient={linkedInvoice.payerType === "warranty" ? !!linkedInvoice.warrantyProvider : !!workOrder.customer}
            hasRecipientEmail={linkedInvoice.payerType === "warranty" ? !!linkedInvoice.warrantyProvider?.billingEmail : !!workOrder.customer.email}
            canVoid={canVoid.success}
            awaitingPickupCount={status === "readyForPickup" ? 1 : 0}
          />
        </div>
      )}

      {showStory && (
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <h2 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            The Story So Far
          </h2>
          <div>
            {[
              { label: "Diagnosis", sub: diagnosisSub, body: <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{workOrder.diagnosisNotes ?? "—"}</p> },
              { label: "Told the customer", sub: "estimate and go-ahead", body: <p className="text-sm" style={{ color: "var(--text-primary)" }}>{toldCustomer}</p> },
              // While the Finish panel is open it is the one place to write what was done, so this row waits for it.
              ...(showFinish
                ? []
                : [{ label: "Work performed", sub: "how it was fixed", body: <WorkOrderRepairNotesForm workOrderId={workOrder.id} initialNotes={workOrder.repairNotes ?? workOrder.diagnosisNotes ?? ""} prefilledFromDiagnosis={!workOrder.repairNotes && !!workOrder.diagnosisNotes} /> }]),
            ].map((row) => (
              <div key={row.label} className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1 sm:gap-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    {row.label}
                  </div>
                  {row.sub && (
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {row.sub}
                    </div>
                  )}
                </div>
                <div>{row.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not billed yet: the one panel that finishes the job, bills it and (if wanted) takes payment. */}
      {showFinish && (status === "inRepair" || status === "readyForPickup") && (
        <div id="finish" className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "2px solid var(--color-brand-600)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {status === "inRepair" ? "Finish this job" : "Bill this job"}
          </h2>
          <p className="text-[11px] mt-0.5 mb-4" style={{ color: "var(--text-muted)" }}>
            {status === "inRepair"
              ? "Say what was done, set the price, and take payment, all in one step. Parts used are added in Parts Needed below."
              : "The repair is done. Set the price and take payment, or create the invoice to send later."}
          </p>
          <FinishJobPanel
            workOrderId={workOrder.id}
            status={status}
            initialRepairNotes={workOrder.repairNotes ?? workOrder.diagnosisNotes ?? ""}
            notesPrefilledFromDiagnosis={!workOrder.repairNotes && !!workOrder.diagnosisNotes}
            initialLabourHours={workOrder.labourHours?.toString() ?? ""}
            parts={workOrder.parts.map((p) => ({ name: p.name, quantity: p.quantity }))}
            services={services.map((sv) => ({ id: sv.id, name: sv.name, price: Number(sv.price), taxable: sv.taxable, description: sv.description }))}
            diagnosticFee={shopProfile?.diagnosticFee ? Number(shopProfile.diagnosticFee) : null}
            showDeliveryFee={showDeliveryFee}
            deliveryFeeDefault={deliveryFeeDefault}
            customerEmail={workOrder.customer.email}
            taxRate={shopProfile?.taxRate ? Number(shopProfile.taxRate) : 0}
            taxLabel={shopProfile?.taxLabel ?? "Tax"}
          />
          {status === "readyForPickup" && (
            <p className="text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>
              Billing this customer for more than one machine at once?{" "}
              <Link href="/invoices/new" className="font-semibold text-brand-600">
                Combine work orders into one invoice
              </Link>{" "}
              instead.
            </p>
          )}
        </div>
      )}

      {/* Parts first when they are still needed for the price; folded away once the job is billed. */}
      {earlyStage || status === "inRepair" || status === "awaitingApproval" ? (
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            Parts Needed
          </h2>
          <WorkOrderPartsPanel
            workOrderId={workOrder.id}
            parts={workOrder.parts.map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, unitSellPrice: p.unitSellPrice?.toString() ?? null }))}
            availableParts={availableParts.map((p) => ({ id: p.id, name: p.name, quantityOnHand: p.quantityOnHand }))}
          />
        </div>
      ) : (
        <Collapsible title="Parts Needed" summary={workOrder.parts.length === 0 ? "none" : `${workOrder.parts.length} used`}>
          <WorkOrderPartsPanel
            workOrderId={workOrder.id}
            parts={workOrder.parts.map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, unitSellPrice: p.unitSellPrice?.toString() ?? null }))}
            availableParts={availableParts.map((p) => ({ id: p.id, name: p.name, quantityOnHand: p.quantityOnHand }))}
          />
        </Collapsible>
      )}

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Status
          </h2>
          <WorkOrderStatusMover
            workOrderId={workOrder.id}
            status={status}
            hasEstimate={!!workOrder.estimateAmount}
            hasInvoice={!!(workOrder.invoice || workOrder.combinedInto)}
            draftInvoiceId={draftInvoiceId}
          />
        </div>
        <WorkOrderStatusPanel
          workOrderId={workOrder.id}
          status={status}
          hasCustomerEmail={!!workOrder.customer.email}
          preApprovalRequired={workOrder.preApprovalRequired}
          draftInvoiceId={draftInvoiceId}
        />
        {workOrder.status === "awaitingApproval" && workOrder.estimateAmount && (
          <div className="mt-3 pt-3 text-xs" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
            Estimate sent: <b style={{ color: "var(--text-secondary)" }}>${workOrder.estimateAmount.toString()}</b> — {workOrder.estimateNotes}
          </div>
        )}
        {workOrder.decidedByName && (
          <div className="mt-3 pt-3 text-xs" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
            {status === "declined" ? "Declined" : "Approved"} by <b style={{ color: "var(--text-secondary)" }}>{workOrder.decidedByName}</b> via{" "}
            {workOrder.approvalMethod === "phone" ? "phone" : workOrder.approvalMethod === "in-person" ? "drop-off — no formal estimate" : "the online link"}{" "}
            on {workOrder.decidedAt?.toLocaleString()}
            {workOrder.notToExceedAmount && (
              <>
                {" "}
                — not to exceed <b style={{ color: "var(--text-secondary)" }}>${workOrder.notToExceedAmount.toString()}</b>
              </>
            )}
          </div>
        )}
      </div>

      {/* Closed with no invoice (an older job): billing is still possible from here. */}
      {status === "closed" && !linkedInvoice && (
        <div id="invoice-card" className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            Invoice
          </h2>
          <GenerateInvoiceButton workOrderId={workOrder.id} hasDiagnosticFee={!!shopProfile?.diagnosticFee} showDeliveryFee={showDeliveryFee} deliveryFeeDefault={deliveryFeeDefault} />
        </div>
      )}

      {!earlyStage && <Collapsible title="Diagnosis" summary={diagnosisSub || undefined}>{diagnosisForm}</Collapsible>}

      <Collapsible title="Emails Sent" summary={sentEmails.length === 0 ? "nothing yet" : `${sentEmails.length} sent`}>
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
      </Collapsible>
    </div>
  );
}
