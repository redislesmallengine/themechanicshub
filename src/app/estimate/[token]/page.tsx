import { prisma } from "@/lib/prisma";
import { EstimateApprovalForm } from "@/components/estimate-approval-form";
import { WrenchIcon } from "@/components/icons";

export default async function EstimatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const workOrder = await prisma.workOrder.findUnique({
    where: { approvalToken: token },
    include: { organization: true, equipment: { include: { equipmentType: true } } },
  });

  if (!workOrder || workOrder.status !== "awaitingApproval" || !workOrder.estimateAmount) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-app)" }}>
        <div
          className="w-full max-w-md rounded-xl p-8 md:p-10 text-center"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 mb-4">
            <WrenchIcon className="w-4.5 h-4.5 text-white" />
          </span>
          <h1 className="text-xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>
            Link no longer valid
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            This estimate has already been answered, or the link has expired. Call the shop if you need anything.
          </p>
        </div>
      </div>
    );
  }

  const equipmentLabel = [workOrder.equipment.make, workOrder.equipment.model].filter(Boolean).join(" ") || workOrder.equipment.equipmentType?.name || "your equipment";

  return (
    <EstimateApprovalForm
      token={token}
      shopName={workOrder.organization.name}
      equipmentLabel={equipmentLabel}
      complaint={workOrder.complaint}
      estimateAmount={workOrder.estimateAmount.toString()}
      estimateNotes={workOrder.estimateNotes ?? ""}
    />
  );
}
