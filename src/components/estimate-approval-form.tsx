"use client";

import { useState, useTransition } from "react";
import { approveEstimateByToken, declineEstimateByToken } from "@/app/(app)/work-orders/actions";
import { WrenchIcon } from "@/components/icons";

export function EstimateApprovalForm({
  token,
  shopName,
  equipmentLabel,
  complaint,
  estimateAmount,
  estimateNotes,
}: {
  token: string;
  shopName: string;
  equipmentLabel: string;
  complaint: string;
  estimateAmount: string;
  estimateNotes: string;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<"approved" | "declined" | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDecision(decision: "approved" | "declined") {
    if (!name.trim()) {
      setError("Enter your name to confirm.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("decidedByName", name.trim());
    startTransition(async () => {
      const action = decision === "approved" ? approveEstimateByToken : declineEstimateByToken;
      const result = await action(token, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDecided(decision);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-app)" }}>
      <div
        className="w-full max-w-lg rounded-xl p-8 md:p-10"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
      >
        <div className="flex items-center gap-2.5 mb-8">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600">
            <WrenchIcon className="w-4.5 h-4.5 text-white" />
          </span>
          <span className="font-extrabold tracking-tight text-sm" style={{ color: "var(--text-primary)" }}>
            {shopName}
          </span>
        </div>

        {decided ? (
          <>
            <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>
              {decided === "approved" ? "Repair authorized" : "Repair declined"}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {decided === "approved"
                ? "Thanks — the shop has been notified and will get started."
                : "Thanks for letting us know. The shop has been notified."}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
              Repair Estimate
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              {equipmentLabel}
            </p>

            <div className="rounded-lg p-4 mb-6" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                Reported Issue
              </div>
              <p className="text-sm mb-3" style={{ color: "var(--text-primary)" }}>
                {complaint}
              </p>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                Estimate
              </div>
              <p className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
                ${estimateAmount}
              </p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {estimateNotes}
              </p>
            </div>

            <label htmlFor="name" className="block font-semibold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Your Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type your name to sign"
              className="w-full mb-2 px-3 py-2.5 rounded-lg text-sm"
              style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
            />
            <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>
              By approving, I authorize this repair up to <b>${estimateAmount}</b>.
            </p>

            {error && (
              <p className="text-xs mb-3 font-medium" style={{ color: "var(--color-error-solid)" }}>
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleDecision("approved")}
                disabled={pending}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 disabled:opacity-60"
              >
                {pending ? "Submitting…" : "Approve"}
              </button>
              <button
                onClick={() => handleDecision("declined")}
                disabled={pending}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-60"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--color-error-solid)" }}
              >
                {pending ? "Submitting…" : "Decline"}
              </button>
            </div>

            <p className="text-xs mt-6 pt-5 text-center" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)" }}>
              Prefer to talk it through? Call the shop instead.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
