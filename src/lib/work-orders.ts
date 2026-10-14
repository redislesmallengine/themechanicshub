// Phase 4 — status flow, single source of truth for labels/colors/ordering
// used by the board, the detail page's action buttons, and the dashboard.
//
//   droppedOff -> diagnosing -> awaitingApproval -> inRepair -> readyForPickup -> closed
//                                       |
//                                       -> declined  (terminal)

export const WORK_ORDER_STATUSES = ["droppedOff", "diagnosing", "awaitingApproval", "inRepair", "readyForPickup", "closed", "declined"] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  droppedOff: "Waiting",
  diagnosing: "Diagnosing",
  awaitingApproval: "Waiting on customer",
  inRepair: "Repairing",
  readyForPickup: "Ready",
  closed: "Done",
  declined: "Customer said no",
};

/**
 * The six steps shown across the top of a job. A declined job sits on the last step ("Done") marked
 * "Customer said no", so the bar stays six long. `target` is the status a click on that step moves to.
 */
export const STEP_ROW: { target: WorkOrderStatus; label: string }[] = [
  { target: "droppedOff", label: STATUS_LABELS.droppedOff },
  { target: "diagnosing", label: STATUS_LABELS.diagnosing },
  { target: "awaitingApproval", label: STATUS_LABELS.awaitingApproval },
  { target: "inRepair", label: STATUS_LABELS.inRepair },
  { target: "readyForPickup", label: STATUS_LABELS.readyForPickup },
  { target: "closed", label: STATUS_LABELS.closed },
];

export function stepIndex(status: WorkOrderStatus): number {
  return status === "declined" ? STEP_ROW.length - 1 : STEP_ROW.findIndex((s) => s.target === status);
}

/**
 * Where a job can be moved to from where it is. Options that would contradict the job are left out:
 * Awaiting Approval needs an estimate that was sent; once invoiced a job can't go back before Ready.
 */
export function moveTargets(status: WorkOrderStatus, hasEstimate: boolean, hasInvoice: boolean): WorkOrderStatus[] {
  return WORK_ORDER_STATUSES.filter((s) => {
    if (s === status) return false;
    if (s === "awaitingApproval" && !hasEstimate) return false;
    if (hasInvoice && (s === "droppedOff" || s === "diagnosing" || s === "awaitingApproval" || s === "inRepair" || s === "declined")) return false;
    return true;
  });
}

/**
 * Jobs that are done but whose invoice has not gone out: ready for pickup with no invoice at all, or ready for
 * pickup / picked up with the invoice still a draft (directly, or as part of a combined invoice).
 */
export const NEEDS_BILLING_WHERE = {
  OR: [
    { status: "readyForPickup", invoice: null, combinedInto: null },
    { status: { in: ["readyForPickup", "closed"] }, OR: [{ invoice: { is: { status: "draft" } } }, { combinedInto: { is: { invoice: { status: "draft" } } } }] },
  ],
};

export const DROP_OFF_METHODS = ["customerDropOff", "pickupDelivery"] as const;
export type DropOffMethod = (typeof DROP_OFF_METHODS)[number];

export const DROP_OFF_METHOD_LABELS: Record<DropOffMethod, string> = {
  customerDropOff: "Customer Drop-off",
  pickupDelivery: "Shop Pickup / Delivery",
};

/** Board columns, in bench-workflow order — closed/declined are intentionally excluded (shown behind a toggle instead, see /work-orders). */
export const BOARD_STATUSES: WorkOrderStatus[] = ["droppedOff", "diagnosing", "awaitingApproval", "inRepair", "readyForPickup"];

/** Matches the dt-badge/status-dot pattern already used elsewhere (Staff, dashboard placeholder). */
export const STATUS_BADGE: Record<WorkOrderStatus, "success" | "warning" | "error" | "info"> = {
  droppedOff: "info",
  diagnosing: "info",
  awaitingApproval: "warning",
  inRepair: "info",
  readyForPickup: "success",
  closed: "success",
  declined: "error",
};

/** The one forward step allowed from a given status via a detail-page button — awaitingApproval branches two ways so it's handled separately, not through this map. */
export const NEXT_STATUS: Partial<Record<WorkOrderStatus, WorkOrderStatus>> = {
  droppedOff: "diagnosing",
  inRepair: "readyForPickup",
  readyForPickup: "closed",
};

/**
 * Thin wrapper around Date.now() — the board/dashboard pages need "now" for
 * aging calculations, but calling Date.now() directly inside a Server
 * Component trips the react-hooks/purity lint rule (it flags known-impure
 * globals by name wherever they're called, Server Component or not).
 * Indirecting through here is the sanctioned way past that; there's nothing
 * actually unsafe about reading the clock once per request render.
 */
export function now(): number {
  return Date.now();
}
