import Link from "next/link";
import { PhoneLink, CallButton } from "@/components/phone-link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, STATUS_BADGE, DROP_OFF_METHOD_LABELS, type WorkOrderStatus } from "@/lib/work-orders";
import { invoiceChip } from "@/lib/invoices";
import { partLineName } from "@/lib/parts";
import { MarkInvoiceSentButton } from "@/components/mark-invoice-sent-button";
import { WorkOrderDiagnosisForm } from "@/components/work-order-diagnosis-form";
import { JobStepper } from "@/components/job-stepper";
import { JobStageCard } from "@/components/job-stage-card";
import { CloseJobAction } from "@/components/close-job-dialog";
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
import { ClaimSteps } from "@/components/claim-steps";

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
      parts: { orderBy: { createdAt: "asc" }, include: { part: { select: { sku: true } } } },
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

  // Pending / Diagnosing: the stage card above is where diagnosing happens. The folded Diagnosis section below is for editing it later.
  const earlyStage = status === "droppedOff" || status === "diagnosing";
  const memberOptions = members.filter((m) => m.user).map((m) => ({ userId: m.userId, name: m.user!.name }));
  const diagnosisForm = (
    <WorkOrderDiagnosisForm
      workOrderId={workOrder.id}
      members={memberOptions}
      currentUserId={session.user.id}
      initialDiagnosisNotes={workOrder.diagnosisNotes ?? ""}
      initialLabourHours={workOrder.labourHours?.toString() ?? ""}
      initialAssignedToUserId={workOrder.assignedToUserId ?? ""}
    />
  );
  const stageCardShows = status === "droppedOff" || status === "diagnosing" || status === "awaitingApproval" || status === "declined" || status === "closed";

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
                  Invoice: {moneyChip.label} · ${linkedInvoice.total.toString()}
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
            <p className="text-sm mt-1.5 max-w-3xl whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
              <span className="text-[10px] font-bold uppercase tracking-wide mr-1.5" style={{ color: "var(--text-muted)" }}>
                Complaint
              </span>
              {workOrder.complaint}
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

      <div className="rounded-xl px-5 py-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <JobStepper workOrderId={workOrder.id} status={status} hasEstimate={!!workOrder.estimateAmount} hasInvoice={!!linkedInvoice} />
      </div>

      {jobIsDone && draftInvoiceId && linkedInvoice && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap" style={{ background: "var(--color-warning-subtle)", border: "1px solid var(--color-warning-border)" }}>
          <p className="text-sm font-semibold flex-1 min-w-[14rem]" style={{ color: "var(--color-warning-text)" }}>
            This job is {status === "closed" ? "Done" : "Ready"}, but its invoice ({linkedInvoice.invoiceNumber}) is still a draft.
          </p>
          <MarkInvoiceSentButton invoiceId={draftInvoiceId} warranty={linkedInvoice.payerType === "warranty"} />
          <Link href={`/invoices/${draftInvoiceId}`} className="text-xs font-bold text-brand-600">
            Open the invoice
          </Link>
        </div>
      )}
      {stageCardShows && (
        <JobStageCard
          workOrderId={workOrder.id}
          status={status}
          customerName={workOrder.customer.name}
          hasCustomerEmail={!!workOrder.customer.email}
          preApprovalRequired={workOrder.preApprovalRequired}
          members={memberOptions}
          currentUserId={session.user.id}
          initialDiagnosisNotes={workOrder.diagnosisNotes ?? ""}
          initialLabourHours={workOrder.labourHours?.toString() ?? ""}
          initialAssignedToUserId={workOrder.assignedToUserId ?? ""}
          estimate={
            workOrder.estimateAmount
              ? { amount: workOrder.estimateAmount.toString(), notes: workOrder.estimateNotes ?? "", sentOn: workOrder.awaitingApprovalAt?.toLocaleDateString() ?? null, sentTo: workOrder.customer.email }
              : null
          }
          decisionLine={workOrder.decidedByName ? `${workOrder.decidedByName} said no ${approvalMethodText}${workOrder.decidedAt ? ` on ${workOrder.decidedAt.toLocaleDateString()}` : ""}.` : null}
          closedOn={workOrder.closedAt?.toLocaleDateString() ?? null}
        />
      )}

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
          {linkedInvoice.payerType === "warranty" && (
            <div className="mb-3">
              <ClaimSteps status={linkedInvoice.status} submittedAt={linkedInvoice.sentAt} paidAt={linkedInvoice.paidAt} />
            </div>
          )}
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

      {/* Once the invoice is paid its own card already has the pickup button, so this one is only for unpaid jobs. */}
      {status === "readyForPickup" && linkedInvoice && linkedInvoice.status !== "paid" && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--bg-surface)", border: "2px solid var(--color-brand-600)" }}>
          <h2 className="text-base font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Ready for the customer
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Press this when they have collected it.
          </p>
          <CloseJobAction workOrderId={workOrder.id} draftInvoiceId={draftInvoiceId} label="The customer picked it up" />
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
            {status === "inRepair" ? "Repair in progress" : "Bill this job"}
          </h2>
          <p className="text-[11px] mt-0.5 mb-4" style={{ color: "var(--text-muted)" }}>
            {status === "inRepair"
              ? "When the repair is finished, say what was done. The price and payment come next. Parts used are added in Parts Needed below."
              : "The repair is done. Set the price, then say whether the customer paid or you will bill them."}
          </p>
          <FinishJobPanel
            workOrderId={workOrder.id}
            status={status}
            initialRepairNotes={workOrder.repairNotes ?? workOrder.diagnosisNotes ?? ""}
            notesPrefilledFromDiagnosis={!workOrder.repairNotes && !!workOrder.diagnosisNotes}
            initialLabourHours={workOrder.labourHours?.toString() ?? ""}
            parts={workOrder.parts.map((p) => ({ name: partLineName(p.name, p.part?.sku), quantity: p.quantity, unitSellPrice: p.unitSellPrice?.toString() ?? null }))}
            labourRate={shopProfile?.labourRate ? Number(shopProfile.labourRate) : null}
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

      {/* The finer details sit folded below, so the screen shows only the current step. */}
      <Collapsible title="Parts Needed" summary={workOrder.parts.length === 0 ? "none yet" : `${workOrder.parts.length} used`}>
        <WorkOrderPartsPanel
          workOrderId={workOrder.id}
          parts={workOrder.parts.map((p) => ({ id: p.id, name: partLineName(p.name, p.part?.sku), quantity: p.quantity, unitSellPrice: p.unitSellPrice?.toString() ?? null }))}
          availableParts={availableParts.map((p) => ({ id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, quantityOnHand: p.quantityOnHand }))}
        />
      </Collapsible>

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

      <Collapsible title="Move to another stage" summary="skip ahead or go back">
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            The steps above and the big button are the normal way. This jumps straight to any stage; the Undo bar appears after.
          </p>
          <WorkOrderStatusMover workOrderId={workOrder.id} status={status} hasEstimate={!!workOrder.estimateAmount} hasInvoice={!!linkedInvoice} draftInvoiceId={draftInvoiceId} />
          {workOrder.decidedByName && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {status === "declined" ? "Declined" : "Approved"} by <b style={{ color: "var(--text-secondary)" }}>{workOrder.decidedByName}</b> via{" "}
              {workOrder.approvalMethod === "phone" ? "phone" : workOrder.approvalMethod === "in-person" ? "drop-off, no formal estimate" : "the online link"} on {workOrder.decidedAt?.toLocaleString()}
              {workOrder.notToExceedAmount && (
                <>
                  {" "}
                  — not to exceed <b style={{ color: "var(--text-secondary)" }}>${workOrder.notToExceedAmount.toString()}</b>
                </>
              )}
            </p>
          )}
        </div>
      </Collapsible>

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
