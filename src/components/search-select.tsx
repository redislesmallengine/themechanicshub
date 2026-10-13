"use client";

import { useId, useMemo, useRef, useState } from "react";

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Shown after the label in a quieter colour (a phone number, stock on hand, a price). */
  hint?: string;
  /** Extra text that should also match what is typed, without being shown. */
  keywords?: string;
}

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

const digits = (s: string) => s.replace(/\D/g, "");
const MAX_SHOWN = 40;

/**
 * A pick-from-a-list field you can type into: type "judy", or part of a phone number or part #, and the list
 * narrows to the matches. Replaces a plain <select> wherever the list can run to dozens of entries. Submits
 * the chosen value under `name` like a select would, and works from the keyboard (arrows, Enter, Escape).
 */
export function SearchSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = "Type to search…",
  disabled = false,
  required = false,
  emptyText = "No matches",
  className = "",
  ariaLabel,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  emptyText?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const qDigits = digits(q);
    return options.filter((o) => {
      const hay = `${o.label} ${o.hint ?? ""} ${o.keywords ?? ""}`.toLowerCase();
      if (q.split(/\s+/).every((word) => hay.includes(word))) return true;
      // "555 0148" should still find (902) 555-0148
      return qDigits.length >= 3 && digits(hay).includes(qDigits);
    });
  }, [options, query]);

  const shown = matches.slice(0, MAX_SHOWN);

  function choose(option: SearchSelectOption) {
    onChange(option.value);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && shown[active]) {
        e.preventDefault();
        choose(shown[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      {/* While the list is open the box shows what is being typed; otherwise the chosen option. */}
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        required={required && !value}
        value={open ? query : (selected?.label ?? "")}
        placeholder={selected ? selected.label : placeholder}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => {
          // a short delay so a click on an option lands before the list closes
          setTimeout(() => {
            setOpen(false);
            setQuery("");
          }, 120);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
        style={{ ...inputStyle, paddingRight: value ? "2rem" : undefined }}
      />
      {value && !disabled && (
        <button
          type="button"
          aria-label="Clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange("");
            setQuery("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-sm leading-none"
          style={{ color: "var(--text-muted)" }}
        >
          ×
        </button>
      )}
      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg py-1 text-xs"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-md)" }}
        >
          {shown.length === 0 && (
            <li className="px-3 py-2" style={{ color: "var(--text-muted)" }}>
              {emptyText}
            </li>
          )}
          {shown.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className="px-3 py-1.5 cursor-pointer flex items-baseline justify-between gap-3"
              style={{ background: i === active ? "var(--bg-surface-subtle)" : undefined, color: "var(--text-primary)", fontWeight: o.value === value ? 700 : 500 }}
            >
              <span>{o.label}</span>
              {o.hint && (
                <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                  {o.hint}
                </span>
              )}
            </li>
          ))}
          {matches.length > shown.length && (
            <li className="px-3 py-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {matches.length - shown.length} more — keep typing to narrow
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
