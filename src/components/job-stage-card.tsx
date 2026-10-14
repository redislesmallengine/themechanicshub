"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startDiagnosis, updateDiagnosis, recordPhoneDecision, changeWorkOrderStatus } from "@/app/(app)/work-orders/actions";
import { EstimateForm } from "@/components/estimate-form";
import { offerUndo } from "@/lib/job-undo";
import type { WorkOrderStatus } from "@/lib/work-orders";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};
const labelStyle = { color: "var(--text-secondary)" };

function Shell({ title, children, tone = "brand" }: { title: string; children: React.ReactNode; tone?: "brand" | "plain" | "error" }) {
  const border = tone === "brand" ? "2px solid var(--color-brand-600)" : tone === "error" ? "2px solid var(--color-error-solid)" : "1px solid var(--border-subtle)";
  return (
    <section className="rounded-xl p-5 space-y-4" style={{ background: "var(--bg-surface)", border }}>
      <h2 className="text-base font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function BigButton({ children, onClick, pending, type = "button" }: { children: React.ReactNode; onClick?: () => void; pending?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} disabled={pending} className="px-5 py-3 rounded-lg text-sm font-extrabold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
      {pending ? "Working…" : children}
    </button>
  );
}

function LinkButton({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="text-xs font-bold disabled:opacity-60 text-left" style={{ color: danger ? "var(--color-error-solid)" : "var(--color-brand-600)" }}>
      {children}
    </button>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
      {error}
    </p>
  );
}

export interface JobStageCardProps {
  workOrderId: string;
  status: WorkOrderStatus;
  customerName: string;
  hasCustomerEmail: boolean;
  preApprovalRequired: boolean | null;
  members: { userId: string; name: string }[];
  currentUserId: string;
  initialDiagnosisNotes: string;
  initialLabourHours: string;
  initialAssignedToUserId: string;
  /** Set once an estimate has gone out. */
  estimate: { amount: string; notes: string; sentOn: string | null; sentTo: string | null } | null;
  /** "Approved by Judy in person on 2026-10-14", shown on a job the customer turned down. */
  decisionLine: string | null;
  closedOn: string | null;
}

/** The one card under the steps: what this stage is for, and one big button to move on. */
export function JobStageCard(props: JobStageCardProps) {
  switch (props.status) {
    case "droppedOff":
      return <WaitingCard {...props} />;
    case "diagnosing":
      return <DiagnosingCard {...props} />;
    case "awaitingApproval":
      return <CustomerCard {...props} />;
    case "declined":
      return <DeclinedCard {...props} />;
    case "closed":
      return <DoneCard {...props} />;
    default:
      return null;
  }
}

function WaitingCard({ workOrderId, members, currentUserId, initialAssignedToUserId }: JobStageCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const defaultTech = initialAssignedToUserId || (members.some((m) => m.userId === currentUserId) ? currentUserId : "");
  const [tech, setTech] = useState(members.length === 1 ? members[0].userId : defaultTech);

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startDiagnosis(workOrderId, tech);
      if (result?.error) {
        setError(result.error);
        return;
      }
      offerUndo(workOrderId, "Started diagnosing", result.previous);
      router.refresh();
    });
  }

  return (
    <Shell title="New job. Nothing has been done yet.">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        The machine is in the shop. Start when someone picks it up.
      </p>
      {members.length > 1 && (
        <div className="max-w-xs">
          <label htmlFor="stage-tech" className="block text-xs font-bold mb-1" style={labelStyle}>
            Who is working on it?
          </label>
          <select id="stage-tech" value={tech} onChange={(e) => setTech(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
            <option value="">Not decided</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <ErrorLine error={error} />
      <BigButton onClick={start} pending={pending}>
        Start diagnosing
      </BigButton>
    </Shell>
  );
}

function DiagnosingCard({ workOrderId, hasCustomerEmail, preApprovalRequired, members, currentUserId, initialDiagnosisNotes, initialLabourHours, initialAssignedToUserId }: JobStageCardProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<"diagnose" | "estimate">("diagnose");
  const [notes, setNotes] = useState(initialDiagnosisNotes);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const soleMember = members.length === 1 ? members[0] : null;
  const defaultTechnician = initialAssignedToUserId || (members.some((m) => m.userId === currentUserId) ? currentUserId : "");
  // The intake answer decides which way leads: customer said "go ahead" -> start the repair; otherwise -> estimate.
  const repairLeads = preApprovalRequired === false;

  function save(outcome: "stay" | "estimate" | "repair") {
    if (!formRef.current) return;
    setError(null);
    setMessage(null);
    const formData = new FormData(formRef.current);
    formData.set("outcome", outcome);
    startTransition(async () => {
      const result = await updateDiagnosis(workOrderId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (outcome === "estimate") {
        setMode("estimate");
        return;
      }
      if (outcome === "repair") {
        offerUndo(workOrderId, "Repair started, approved in person", result.previous);
      } else {
        setMessage("Saved.");
      }
      router.refresh();
    });
  }

  return (
    <Shell title={mode === "estimate" ? "Send the customer an estimate" : "What is wrong with it?"}>
      {/* Kept mounted (hidden) while the estimate form is open, so what was typed is not lost by going Back. */}
      <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-3" hidden={mode === "estimate"}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Write what you found. Saving never moves the job.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="md:col-span-2">
            <label htmlFor="diagnosisNotes" className="block font-bold mb-1" style={labelStyle}>
              What you found
            </label>
            <textarea id="diagnosisNotes" name="diagnosisNotes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Needs a new carburetor kit and fuel line…" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="labourHours" className="block font-bold mb-1" style={labelStyle}>
                Hours so far
              </label>
              <input id="labourHours" name="labourHours" type="number" step="0.25" min="0" inputMode="decimal" defaultValue={initialLabourHours} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
            </div>
            {soleMember ? (
              <input type="hidden" name="assignedToUserId" value={soleMember.userId} />
            ) : (
              <div>
                <label htmlFor="assignedToUserId" className="block font-bold mb-1" style={labelStyle}>
                  Technician
                </label>
                <select id="assignedToUserId" name="assignedToUserId" defaultValue={defaultTechnician} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
                  <option value="">Not decided</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <ErrorLine error={error} />
        {message && (
          <p className="text-xs font-semibold" style={{ color: "var(--color-success-solid)" }}>
            {message}
          </p>
        )}
        <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
          {repairLeads ? (
            <>
              <BigButton onClick={() => save("repair")} pending={pending}>
                Start the repair
              </BigButton>
              <LinkButton onClick={() => save("estimate")} disabled={pending}>
                Send a written estimate instead
              </LinkButton>
            </>
          ) : (
            <>
              <BigButton onClick={() => save("estimate")} pending={pending}>
                Send an estimate
              </BigButton>
              <LinkButton onClick={() => save("repair")} disabled={pending}>
                The customer already said yes, start the repair
              </LinkButton>
            </>
          )}
          <LinkButton onClick={() => save("stay")} disabled={pending}>
            Just save for now
          </LinkButton>
        </div>
      </form>
      {mode === "estimate" && <EstimateForm workOrderId={workOrderId} hasCustomerEmail={hasCustomerEmail} defaultNotes={notes} onBack={() => setMode("diagnose")} />}
    </Shell>
  );
}

function CustomerCard({ workOrderId, customerName, estimate }: JobStageCardProps) {
  const router = useRouter();
  const [name, setName] = useState(customerName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = recordPhoneDecision.bind(null, workOrderId);

  function decide(decision: "approved" | "declined") {
    setError(null);
    const formData = new FormData();
    formData.set("decision", decision);
    formData.set("decidedByName", name);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      offerUndo(workOrderId, decision === "approved" ? "Repair started, customer said yes" : "Closed, customer said no", result.previous);
      router.refresh();
    });
  }

  return (
    <Shell title="Waiting for the customer">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {estimate ? (
          <>
            Estimate of <b style={{ color: "var(--text-primary)" }}>${estimate.amount}</b> sent{estimate.sentTo ? ` to ${estimate.sentTo}` : ""}
            {estimate.sentOn ? ` on ${estimate.sentOn}` : ""}. When they answer on the link, this job moves on by itself.
          </>
        ) : (
          "An estimate is out with the customer."
        )}
      </p>
      {estimate?.notes && (
        <p className="text-xs whitespace-pre-wrap rounded-lg px-3 py-2" style={{ background: "var(--bg-surface-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
          {estimate.notes}
        </p>
      )}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Did they phone or tell you at the counter? Press their answer here.
      </p>
      <div className="max-w-xs">
        <label htmlFor="decidedBy" className="block text-xs font-bold mb-1" style={labelStyle}>
          Who gave the answer?
        </label>
        <input id="decidedBy" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
      </div>
      <ErrorLine error={error} />
      <div className="flex items-center gap-5 flex-wrap">
        <BigButton onClick={() => decide("approved")} pending={pending}>
          The customer said yes
        </BigButton>
        <LinkButton onClick={() => decide("declined")} disabled={pending} danger>
          The customer said no
        </LinkButton>
      </div>
    </Shell>
  );
}

function DoneCard({ workOrderId, closedOn }: JobStageCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reopen() {
    setError(null);
    startTransition(async () => {
      const result = await changeWorkOrderStatus(workOrderId, "readyForPickup");
      if (result?.error) {
        setError(result.error);
        return;
      }
      offerUndo(workOrderId, "Moved back to Ready", result.previous);
      router.refresh();
    });
  }

  return (
    <Shell title="Done" tone="plain">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {closedOn ? `Picked up on ${closedOn}.` : "Picked up."} Nothing more to do.
      </p>
      <ErrorLine error={error} />
      <div>
        <LinkButton onClick={reopen} disabled={pending}>
          {pending ? "Working…" : "Not picked up after all? Move it back to Ready"}
        </LinkButton>
      </div>
    </Shell>
  );
}

function DeclinedCard({ workOrderId, decisionLine }: JobStageCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reopen() {
    setError(null);
    startTransition(async () => {
      const result = await changeWorkOrderStatus(workOrderId, "diagnosing");
      if (result?.error) {
        setError(result.error);
        return;
      }
      offerUndo(workOrderId, "Job reopened", result.previous);
      router.refresh();
    });
  }

  return (
    <Shell title="Closed. The customer said no." tone="error">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        No repair was done and nothing is owed. {decisionLine ?? ""}
      </p>
      <ErrorLine error={error} />
      <div>
        <LinkButton onClick={reopen} disabled={pending}>
          {pending ? "Working…" : "They changed their mind. Reopen this job"}
        </LinkButton>
      </div>
    </Shell>
  );
}
