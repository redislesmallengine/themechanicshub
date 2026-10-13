// Warranty claims: an invoice billed to a manufacturer / warranty company instead of the customer.
// A claim moves through three steps, which are the invoice's own statuses in plain words:
//
//   Not submitted (draft)  ->  Submitted (sent or viewed, dated by sentAt)  ->  Paid (paidAt)
//
// Plain functions with no imports so they can be tested on their own.

/** A submitted claim still unpaid after this many days is flagged as waiting too long. */
export const CLAIM_REMINDER_DAYS = 30;

export type ClaimStage = "notSubmitted" | "submitted" | "paid" | "void";

export const CLAIM_STAGE_LABELS: Record<ClaimStage, string> = {
  notSubmitted: "Not submitted",
  submitted: "Submitted",
  paid: "Paid",
  void: "Void",
};

export function claimStage(status: string): ClaimStage {
  if (status === "paid") return "paid";
  if (status === "void") return "void";
  if (status === "sent" || status === "viewed") return "submitted";
  return "notSubmitted";
}

const DAY_MS = 86400000;

/** Whole days between a date and now, or null when there is no date. */
export function daysSince(date: Date | null | undefined, nowMs: number): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((nowMs - date.getTime()) / DAY_MS));
}

/** Submitted, unpaid, and past the reminder window. */
export function claimIsLate(status: string, submittedAt: Date | null | undefined, nowMs: number, reminderDays = CLAIM_REMINDER_DAYS): boolean {
  if (claimStage(status) !== "submitted") return false;
  const age = daysSince(submittedAt, nowMs);
  return age !== null && age >= reminderDays;
}

export interface ClaimLike {
  status: string;
  total: number;
  sentAt: Date | null;
}

export interface ClaimSummary {
  notSubmitted: { count: number; amount: number };
  submitted: { count: number; amount: number };
  late: { count: number; amount: number };
  paid: { count: number; amount: number };
}

/** Counts and dollar totals for a set of claims (void claims are ignored). */
export function summarizeClaims(claims: ClaimLike[], nowMs: number): ClaimSummary {
  const out: ClaimSummary = {
    notSubmitted: { count: 0, amount: 0 },
    submitted: { count: 0, amount: 0 },
    late: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 },
  };
  for (const c of claims) {
    const stage = claimStage(c.status);
    if (stage === "void") continue;
    const bucket = stage === "notSubmitted" ? out.notSubmitted : stage === "submitted" ? out.submitted : out.paid;
    bucket.count++;
    bucket.amount += c.total;
    if (claimIsLate(c.status, c.sentAt, nowMs)) {
      out.late.count++;
      out.late.amount += c.total;
    }
  }
  return out;
}
