// A tiny store behind the "Moved to Repairing · Undo" bar. Any button that moves a job calls showUndo();
// the host (src/components/undo-toast.tsx, mounted once in the app layout) shows it for ten seconds.

export const UNDO_SECONDS = 10;

export interface UndoToast {
  id: number;
  message: string;
  /** Puts things back. Resolves with an error message when it could not. */
  undo: () => Promise<{ error?: string } | undefined | void>;
}

let current: UndoToast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeUndo(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getUndoSnapshot(): UndoToast | null {
  return current;
}

export function getUndoServerSnapshot(): UndoToast | null {
  return null;
}

export function showUndo(message: string, undo: UndoToast["undo"]) {
  current = { id: nextId++, message, undo };
  emit();
}

export function clearUndo(id?: number) {
  if (id !== undefined && current?.id !== id) return;
  current = null;
  emit();
}
