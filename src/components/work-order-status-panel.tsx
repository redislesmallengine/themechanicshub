"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startDiagnosis,
  sendEstimate,
  skipEstimateApproval,
  recordPhoneDecision,
  markReadyForPickup,
  closeWorkOrder,
} from "@/app/(app)/work-orders/actions";
import type { WorkOrderStatus } from "@/lib/work-orders";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

type ActionResult = { success?: boolean; error?: string } | undefined;

function SimpleAction({ label, action }: { label: string; action: () => Promise<ActionResult> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button onClick={handleClick} disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Working…" : label}
      </button>
      {error && (
        <p className="text-xs font-semibold mt-2" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function SendEstimateForm({ workOrderId, hasCustomerEmail }: { workOrderId: string; hasCustomerEmail: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = sendEstimate.bind(null, workOrderId);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      {!hasCustomerEmail && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-warning-solid)" }}>
          This customer has no email on file — sending will fail. Record the approval by phone instead once diagnosed.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div>
          <label htmlFor="estimateAmount" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Estimate Amount ($)
          </label>
          <input id="estimateAmount" name="estimateAmount" type="number" step="0.01" min="0" required className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="estimateNotes" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            What it covers
          </label>
          <input id="estimateNotes" name="estimateNotes" type="text" required placeholder="Plain language — this is what the customer sees" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
      </div>
      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Sending…" : "Send Estimate for Approval"}
      </button>
    </form>
  );
}

/** The fast path for the ~90% case — customer said "just fix it," no formal $ quote needed. Skips straight to In Repair. */
function SkipEstimateForm({ workOrderId }: { workOrderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = skipEstimateApproval.bind(null, workOrderId);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg p-3" style={{ background: "var(--color-success-subtle)", border: "1px solid var(--color-success-border)" }}>
      <p className="text-xs font-bold mb-2" style={{ color: "var(--text-primary)" }}>
        Customer already said &ldquo;just fix it&rdquo;?
      </p>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="max-w-[200px]">
          <label htmlFor="notToExceedAmount" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Not-to-exceed ($) — optional
          </label>
          <input
            id="notToExceedAmount"
            name="notToExceedAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Leave blank if open-ended"
            className="w-full px-3 py-2 rounded-lg text-xs font-mono"
            style={inputStyle}
          />
        </div>
        <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {pending ? "Starting…" : "Start Repair Now"}
        </button>
      </div>
      {error && (
        <p className="text-xs font-semibold mt-2" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </form>
  );
}

function PhoneDecisionForm({ workOrderId }: { workOrderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = recordPhoneDecision.bind(null, workOrderId);

  function handleSubmit(formData: FormData, decision: "approved" | "declined") {
    setError(null);
    formData.set("decision", decision);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form className="space-y-3">
      <div>
        <label htmlFor="decidedByName" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Who authorized this? (phone approval)
        </label>
        <input id="decidedByName" name="decidedByName" type="text" placeholder="Customer's name" className="w-full px-3 py-2 rounded-lg text-xs font-medium max-w-xs" style={inputStyle} />
      </div>
      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={(e) => handleSubmit(new FormData(e.currentTarget.closest("form")!), "approved")}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
        >
          Record Phone Approval
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={(e) => handleSubmit(new FormData(e.currentTarget.closest("form")!), "declined")}
          className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--color-error-solid)" }}
        >
          Record Phone Decline
        </button>
      </div>
    </form>
  );
}

export function WorkOrderStatusPanel({
  workOrderId,
  status,
  hasCustomerEmail,
}: {
  workOrderId: string;
  status: WorkOrderStatus;
  hasCustomerEmail: boolean;
}) {
  switch (status) {
    case "droppedOff":
      return (
        <div className="space-y-4">
          <SkipEstimateForm workOrderId={workOrderId} />
          <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <SimpleAction label="Start Diagnosis" action={() => startDiagnosis(workOrderId)} />
          </div>
          <details className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <summary className="text-xs font-bold cursor-pointer" style={{ color: "var(--text-secondary)" }}>
              Need a formal written estimate instead?
            </summary>
            <div className="mt-3">
              <SendEstimateForm workOrderId={workOrderId} hasCustomerEmail={hasCustomerEmail} />
            </div>
          </details>
        </div>
      );
    case "diagnosing":
      return (
        <div className="space-y-4">
          <SkipEstimateForm workOrderId={workOrderId} />
          <details className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <summary className="text-xs font-bold cursor-pointer" style={{ color: "var(--text-secondary)" }}>
              Need a formal written estimate instead?
            </summary>
            <div className="mt-3">
              <SendEstimateForm workOrderId={workOrderId} hasCustomerEmail={hasCustomerEmail} />
            </div>
          </details>
        </div>
      );
    case "awaitingApproval":
      return (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Waiting on the customer&apos;s approval link, or record it here if they called in.
          </p>
          <PhoneDecisionForm workOrderId={workOrderId} />
        </div>
      );
    case "inRepair":
      return <SimpleAction label="Mark Ready for Pickup" action={() => markReadyForPickup(workOrderId)} />;
    case "readyForPickup":
      return <SimpleAction label="Mark Picked Up / Close" action={() => closeWorkOrder(workOrderId)} />;
    case "closed":
      return (
        <p className="text-xs font-semibold" style={{ color: "var(--color-success-solid)" }}>
          Closed — picked up.
        </p>
      );
    case "declined":
      return (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          Declined by the customer.
        </p>
      );
    default:
      return null;
  }
}
