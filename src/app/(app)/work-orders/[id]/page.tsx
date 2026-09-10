import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, STATUS_BADGE, type WorkOrderStatus } from "@/lib/work-orders";
import { WorkOrderStatusPanel } from "@/components/work-order-status-panel";
import { WorkOrderDiagnosisForm } from "@/components/work-order-diagnosis-form";
import { WorkOrderPartsPanel } from "@/components/work-order-parts-panel";

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
    },
  });
  if (!workOrder || workOrder.organizationId !== organizationId) notFound();

  const [{ members }, availableParts] = await Promise.all([
    auth.api.listMembers({ headers: reqHeaders }),
    prisma.part.findMany({ where: { organizationId, quantityOnHand: { gt: 0 } }, orderBy: { name: "asc" } }),
  ]);

  const status = workOrder.status as WorkOrderStatus;
  const equipmentLabel = [workOrder.equipment.make, workOrder.equipment.model].filter(Boolean).join(" ") || workOrder.equipment.equipmentType?.name || "Equipment";

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
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
          Complaint
        </div>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {workOrder.complaint}
        </p>
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Status
        </h2>
        <WorkOrderStatusPanel workOrderId={workOrder.id} status={status} hasCustomerEmail={!!workOrder.customer.email} />
        {workOrder.status === "awaitingApproval" && workOrder.estimateAmount && (
          <div className="mt-3 pt-3 text-xs" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
            Estimate sent: <b style={{ color: "var(--text-secondary)" }}>${workOrder.estimateAmount.toString()}</b> — {workOrder.estimateNotes}
          </div>
        )}
        {workOrder.decidedByName && (
          <div className="mt-3 pt-3 text-xs" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
            {status === "declined" ? "Declined" : "Approved"} by <b style={{ color: "var(--text-secondary)" }}>{workOrder.decidedByName}</b> via{" "}
            {workOrder.approvalMethod === "phone" ? "phone" : "the online link"} on {workOrder.decidedAt?.toLocaleString()}
          </div>
        )}
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Diagnosis
        </h2>
        <WorkOrderDiagnosisForm
          workOrderId={workOrder.id}
          members={members.filter((m) => m.user).map((m) => ({ userId: m.userId, name: m.user!.name }))}
          initialDiagnosisNotes={workOrder.diagnosisNotes ?? ""}
          initialLaborHours={workOrder.laborHours?.toString() ?? ""}
          initialAssignedToUserId={workOrder.assignedToUserId ?? ""}
        />
      </div>

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
    </div>
  );
}
