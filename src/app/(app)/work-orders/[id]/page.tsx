import Link from "next/link";
import { PhoneLink, CallButton } from "@/components/phone-link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, STATUS_BADGE, DROP_OFF_METHOD_LABELS, STEP_ROW, needsPricing, viewableSteps, canMoveBackTo, stepIndex, type StepTarget, type WorkOrderStatus } from "@/lib/work-orders";
import { invoiceChip } from "@/lib/invoices";
import { ensureInvoiceShortCode } from "@/lib/invoice-short-link";
import { partLineName } from "@/lib/parts";
import { secondaryButton } from "@/lib/ui";
import { WorkOrderDiagnosisForm } from "@/components/work-order-diagnosis-form";
import { JobStepper } from "@/components/job-stepper";
import { JobStageCard } from "@/components/job-stage-card";
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
import { RepairStepPanel } from "@/components/repair-step-panel";
import { BillingScreen } from "@/components/billing-screen";
import { ViewingBanner } from "@/components/viewing-banner";
import { InvoiceStatusPanel } from "@/components/invoice-status-panel";
import { ClaimSteps } from "@/components/claim-steps";

export default async function WorkOrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  const { view } = await searchParams;
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

  const [{ members }, availableParts, shopProfile, sentEmails, canDelete, membership, services, canVoid, organization, warrantyProviders] = await Promise.all([
    auth.api.listMembers({ headers: reqHeaders }),
    prisma.part.findMany({ where: { organizationId, quantityOnHand: { gt: 0 } }, orderBy: { name: "asc" } }),
    prisma.shopProfile.findUnique({ where: { organizationId } }),
    prisma.sentEmail.findMany({ where: { relatedType: "estimate", relatedId: workOrder.id }, orderBy: { createdAt: "desc" } }),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { workOrder: ["delete"] } } }),
    prisma.member.findFirst({ where: { organizationId, userId: session.user.id } }),
    prisma.service.findMany({ where: { organizationId, active: true }, orderBy: { name: "asc" } }),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["void"] } } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.warrantyProvider.findMany({ where: { organizationId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const isOwner = membership?.role === "owner";

  const status = workOrder.status as WorkOrderStatus;
  // The money side of this job, in plain words, so the job and its invoice are never read as contradicting each other.
  const linkedInvoice = workOrder.invoice ?? workOrder.combinedInto?.invoice ?? null;
  const shortCode = linkedInvoice ? await ensureInvoiceShortCode(linkedInvoice.id) : null;
  const shareUrl = linkedInvoice ? (shortCode ? `${process.env.BETTER_AUTH_URL}/i/${shortCode}` : `${process.env.BETTER_AUTH_URL}/invoice/${linkedInvoice.viewToken}`) : "";
  const moneyChip = linkedInvoice ? invoiceChip(linkedInvoice.status, linkedInvoice.dueDate, linkedInvoice.payerType) : null;
  const jobIsDone = status === "readyForPickup" || status === "closed";
  // Repairing shows only the repair; once "Repair finished" is pressed (or the job is parked on Ready) and nothing is invoiced, the Billing screen takes over.
  const repairFinished = !!workOrder.repairFinishedAt;
  const repairing = status === "inRepair" && !repairFinished && !linkedInvoice;
  const billing = needsPricing(status, repairFinished, !!linkedInvoice);
  // An earlier step being looked at (?view=...): the page shows that step and the job stays where it is.
  const viewStep = (viewableSteps(status, repairFinished, !!linkedInvoice) as string[]).includes(view ?? "") ? (view as StepTarget) : null;
  const viewLabel = viewStep ? (STEP_ROW.find((x) => x.target === viewStep)?.label ?? "") : "";
  const currentLabel = status === "declined" ? STATUS_LABELS.declined : STEP_ROW[stepIndex(status, repairFinished)].label;
  const equipmentLabel = [workOrder.equipment.make, workOrder.equipment.model].filter(Boolean).join(" / ") || workOrder.equipment.equipmentType?.name || "Equipment";
  // The option shows whenever this work order was marked Shop
  // Pickup/Delivery at intake -- independent of whether Shop Profile has a
  // default amount, so a shop that hasn't set one yet still gets prompted
  // and can just type the amount in. The default only controls what the
  // field starts pre-filled with.
  const showDeliveryFee = workOrder.dropOffMethod === "pickupDelivery";
  const deliveryFeeDefault = shopProfile?.deliveryFee?.toString() ?? "";

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

  const invoiceCard = linkedInvoice ? (
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
            <div className="flex items-center gap-2 flex-wrap">
              {linkedInvoice.status === "draft" && (
                <a href={`/invoice/${linkedInvoice.viewToken}`} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
                  Preview invoice (what the customer sees)
                </a>
              )}
              <Link href={`/invoices/${linkedInvoice.id}`} className={secondaryButton}>
                Open the full invoice →
              </Link>
            </div>
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
            send={{ customerName: workOrder.customer.name, customerPhone: workOrder.customer.phone, invoiceNumber: linkedInvoice.invoiceNumber, shopName: organization?.name ?? "the shop", shareUrl, pdfHref: `/api/invoices/${linkedInvoice.id}/pdf`, recipientEmail: linkedInvoice.payerType === "warranty" ? linkedInvoice.warrantyProvider?.billingEmail ?? null : workOrder.customer.email }}
            closeableWorkOrderId={status === "readyForPickup" && !workOrder.combinedInto ? workOrder.id : null}
          />
        </div>
  ) : null;

  return (
    <div className="readable p-6 space-y-6">
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
        <JobStepper workOrderId={workOrder.id} status={status} hasInvoice={!!linkedInvoice} repairFinished={repairFinished} viewing={viewStep} />
      </div>

      {viewStep ? (
        <>
          <ViewingBanner workOrderId={workOrder.id} viewingLabel={viewLabel} viewingTarget={viewStep} currentLabel={currentLabel} canMoveBack={canMoveBackTo(viewStep, status, repairFinished, !!workOrder.estimateAmount, !!linkedInvoice)} warnsAboutApproval={viewStep === "droppedOff" || viewStep === "diagnosing" || viewStep === "awaitingApproval"} />

          {viewStep === "droppedOff" && (
            <div className="rounded-xl p-5 space-y-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <h2 className="text-xl font-extrabold">Waiting: dropped off</h2>
              <p className="text-base">Dropped off on {workOrder.createdAt.toLocaleDateString()}{workOrder.dropOffMethod ? ` · ${DROP_OFF_METHOD_LABELS[workOrder.dropOffMethod as keyof typeof DROP_OFF_METHOD_LABELS] ?? workOrder.dropOffMethod}` : ""}.</p>
              <p className="text-base whitespace-pre-wrap">
                <b>Complaint:</b> {workOrder.complaint}
              </p>
            </div>
          )}

          {viewStep === "diagnosing" && (
            <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <h2 className="text-xl font-extrabold">Diagnosis</h2>
              <p className="text-base">Changes you save here are kept. The job stays on {currentLabel}.</p>
              {diagnosisForm}
            </div>
          )}

          {viewStep === "awaitingApproval" && (
            <div className="rounded-xl p-5 space-y-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <h2 className="text-xl font-extrabold">Waiting on customer: what the customer was told</h2>
              <p className="text-base whitespace-pre-wrap">{toldCustomer}</p>
              {workOrder.awaitingApprovalAt && <p className="text-base">Estimate sent on {workOrder.awaitingApprovalAt.toLocaleDateString()}.</p>}
            </div>
          )}

          {viewStep === "inRepair" && (
            status === "inRepair" ? (
              <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                <h2 className="text-xl font-extrabold mb-4">Repairing</h2>
                <RepairStepPanel
                  workOrderId={workOrder.id}
                  returningToBilling
                  initialRepairNotes={workOrder.repairNotes ?? workOrder.diagnosisNotes ?? ""}
                  notesPrefilledFromDiagnosis={false}
                  parts={workOrder.parts.map((p) => ({ id: p.id, name: partLineName(p.name, p.part?.sku), quantity: p.quantity, unitSellPrice: p.unitSellPrice?.toString() ?? null }))}
                  availableParts={availableParts.map((p) => ({ id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, quantityOnHand: p.quantityOnHand }))}
                />
              </div>
            ) : (
              <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                <h2 className="text-xl font-extrabold">Repairing: what was done</h2>
                <p className="text-base whitespace-pre-wrap">{workOrder.repairNotes ?? "Nothing was written."}</p>
                <h3 className="text-lg font-extrabold">Parts used</h3>
                {workOrder.parts.length === 0 ? <p className="text-base">No parts.</p> : (
                  <ul className="text-base list-disc pl-6">
                    {workOrder.parts.map((p) => (
                      <li key={p.id}>
                        {partLineName(p.name, p.part?.sku)} × {p.quantity}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          )}

          {viewStep === "billing" && invoiceCard}
        </>
      ) : (
        <>
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
      {invoiceCard}

      {showStory && (
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <h2 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Job summary
          </h2>
          <div>
            {[
              { label: "Told the customer", sub: "estimate and go-ahead", body: <p className="text-sm" style={{ color: "var(--text-primary)" }}>{toldCustomer}</p> },
              // While the Finish panel is open it is the one place to write what was done, so this row waits for it.
              ...(repairing || billing
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

      {/* Repairing: only the repair -- what was done, the parts used, and one big button to move on to Billing. */}
      {repairing && (
        <div id="finish" className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "2px solid var(--color-brand-600)" }}>
          <h2 className="text-xl font-extrabold mb-4">Repairing</h2>
          <RepairStepPanel
            workOrderId={workOrder.id}
            initialRepairNotes={workOrder.repairNotes ?? workOrder.diagnosisNotes ?? ""}
            notesPrefilledFromDiagnosis={!workOrder.repairNotes && !!workOrder.diagnosisNotes}
            parts={workOrder.parts.map((p) => ({ id: p.id, name: partLineName(p.name, p.part?.sku), quantity: p.quantity, unitSellPrice: p.unitSellPrice?.toString() ?? null }))}
            availableParts={availableParts.map((p) => ({ id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, quantityOnHand: p.quantityOnHand }))}
          />
        </div>
      )}

      {/* Billing: the repair is done and nothing is invoiced yet. Big rows, a preview of the customer's invoice, then create it. */}
      {billing && (status === "inRepair" || status === "readyForPickup") && (
        <div id="finish" className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "2px solid var(--color-brand-600)" }}>
          <h2 className="text-xl font-extrabold mb-4">Billing</h2>
          <BillingScreen
            workOrderId={workOrder.id}
            status={status}
            initialNotes={workOrder.repairNotes ?? workOrder.diagnosisNotes ?? ""}
            parts={workOrder.parts.map((p) => ({ id: p.id, name: partLineName(p.name, p.part?.sku), quantity: p.quantity, unitSellPrice: p.unitSellPrice?.toString() ?? null }))}
            availableParts={availableParts.map((p) => ({ id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, quantityOnHand: p.quantityOnHand }))}
            labourHours={workOrder.labourHours?.toString() ?? ""}
            labourRate={shopProfile?.labourRate ? Number(shopProfile.labourRate) : null}
            services={services.map((sv) => ({ id: sv.id, name: sv.name, price: Number(sv.price), taxable: sv.taxable, description: sv.description }))}
            diagnosticFee={shopProfile?.diagnosticFee ? Number(shopProfile.diagnosticFee) : null}
            showDeliveryFee={showDeliveryFee}
            deliveryFeeDefault={deliveryFeeDefault}
            customerEmail={workOrder.customer.email}
            customerName={workOrder.customer.name}
            equipmentLabel={equipmentLabel}
            shopName={organization?.name ?? "Your shop"}
            hstNumber={shopProfile?.hstNumber ?? null}
            warrantyProviders={warrantyProviders}
            taxRate={shopProfile?.taxRate ? Number(shopProfile.taxRate) : 0}
            taxLabel={shopProfile?.taxLabel ?? "Tax"}
          />
        </div>
      )}

      {/* Closed with no invoice (an older job): billing is still possible from here. */}
      {status === "closed" && !linkedInvoice && (
        <div id="invoice-card" className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            Invoice
          </h2>
          <GenerateInvoiceButton workOrderId={workOrder.id} hasDiagnosticFee={!!shopProfile?.diagnosticFee} showDeliveryFee={showDeliveryFee} deliveryFeeDefault={deliveryFeeDefault} />
        </div>
      )}

        </>
      )}

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
