import type { CSSProperties } from "react";

/**
 * Customer phone numbers are typed free-text in North American format, e.g.
 * "(902) 555-0100". A tel: link wants a clean number, so strip the
 * punctuation and add +1 to a bare 10-digit number (same assumption the
 * WhatsApp button already makes). Anything else is passed through as digits
 * -- a number with its own country code still dials, best effort.
 */
export function telHref(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return trimmed.startsWith("+") ? `tel:+${digits}` : `tel:${digits}`;
}

/** A phone number that dials when tapped (on a computer it just behaves like a link). Renders nothing for an empty number. */
export function PhoneLink({ phone, className, style }: { phone: string | null | undefined; className?: string; style?: CSSProperties }) {
  if (!phone?.trim()) return null;
  return (
    <a href={telHref(phone)} className={className ?? "font-semibold text-brand-600 hover:underline"} style={style}>
      {phone}
    </a>
  );
}

/** Big green Call button for phone screens only (md:hidden) -- on a computer the number itself is enough. */
export function CallButton({ phone, name }: { phone: string | null | undefined; name: string }) {
  if (!phone?.trim()) return null;
  const first = name.trim().split(/\s+/)[0] || "customer";
  return (
    <a
      href={telHref(phone)}
      className="md:hidden inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm"
      style={{ background: "var(--color-success-solid)" }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
      </svg>
      Call {first}
    </a>
  );
}
