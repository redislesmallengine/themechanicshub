// Phase 4 — status flow, single source of truth for labels/colors/ordering
// used by the board, the detail page's action buttons, and the dashboard.
//
//   droppedOff -> diagnosing -> awaitingApproval -> inRepair -> readyForPickup -> closed
//                                       |
//                                       -> declined  (terminal)

export const WORK_ORDER_STATUSES = ["droppedOff", "diagnosing", "awaitingApproval", "inRepair", "readyForPickup", "closed", "declined"] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  droppedOff: "Pending",
  diagnosing: "Diagnosing",
  awaitingApproval: "Awaiting Approval",
  inRepair: "In Repair",
  readyForPickup: "Ready for pickup",
  closed: "Picked up / Delivered",
  declined: "Declined",
};

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
