// Shared look for the "second choice" actions that sit beside a card's one big blue button: a white button with a
// blue outline. The big filled button stays the main action; these are the quieter options next to it.

const base = "px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--bg-surface)] border text-left disabled:opacity-60";

export const secondaryButton = `${base} text-brand-600 border-[var(--color-brand-600)] hover:bg-[var(--color-info-subtle)]`;
export const dangerButton = `${base} text-[var(--color-error-solid)] border-[var(--color-error-solid)] hover:bg-[var(--color-error-subtle)]`;
