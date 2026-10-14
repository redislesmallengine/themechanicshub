"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearUndo, getUndoServerSnapshot, getUndoSnapshot, subscribeUndo, UNDO_SECONDS } from "@/lib/undo-toast";

/** The dark bar at the bottom of the screen after a job moves: what happened, and a way to take it back for ten seconds. */
export function UndoToastHost() {
  const toast = useSyncExternalStore(subscribeUndo, getUndoSnapshot, getUndoServerSnapshot);
  if (!toast) return null;
  // Keyed so every new move restarts the timer and the progress bar.
  return <UndoBar key={toast.id} toast={toast} />;
}

function UndoBar({ toast }: { toast: NonNullable<ReturnType<typeof getUndoSnapshot>> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => clearUndo(toast.id), (error ? UNDO_SECONDS * 2 : UNDO_SECONDS) * 1000);
    return () => clearTimeout(timer);
  }, [toast.id, error]);

  function handleUndo() {
    setError(null);
    startTransition(async () => {
      const result = await toast.undo();
      if (result && result.error) {
        setError(result.error);
        return;
      }
      clearUndo(toast.id);
      router.refresh();
    });
  }

  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 pointer-events-none">
      <div className="relative overflow-hidden pointer-events-auto flex items-center gap-4 rounded-xl pl-4 pr-3 py-2.5 text-sm font-semibold max-w-full" style={{ background: "#0f172a", color: "#f1f5f9", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
        <span>{error ?? toast.message}</span>
        {!error && (
          <button type="button" onClick={handleUndo} disabled={pending} className="px-2 py-1 rounded-md text-sm font-extrabold underline disabled:opacity-60" style={{ color: "#8fb4ff" }}>
            {pending ? "Undoing…" : "Undo"}
          </button>
        )}
        <button type="button" onClick={() => clearUndo(toast.id)} aria-label="Dismiss" className="px-1.5 text-base leading-none opacity-70 hover:opacity-100">
          ×
        </button>
        {!error && <span className="undo-timer absolute left-0 bottom-0 h-[3px]" style={{ background: "#5b8def", animationDuration: `${UNDO_SECONDS}s` }} />}
      </div>
    </div>
  );
}
