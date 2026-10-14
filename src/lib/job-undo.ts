import { restoreWorkOrderState, type StatusSnapshot } from "@/app/(app)/work-orders/actions";
import { showUndo } from "@/lib/undo-toast";

/** After any button that moved a job: show "<message> · Undo" for ten seconds, which puts the job back as `previous` describes. */
export function offerUndo(workOrderId: string, message: string, previous: StatusSnapshot | undefined) {
  if (!previous) return;
  showUndo(message, () => restoreWorkOrderState(workOrderId, previous));
}
