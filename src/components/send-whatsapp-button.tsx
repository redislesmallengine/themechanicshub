"use client";

import { useState } from "react";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

/**
 * WhatsApp's click-to-chat links want digits only, no "+", spaces, or
 * punctuation, with the country code included. Customer phone numbers here
 * are typed free-text in North American format (e.g. "(902) 555-0100"), so
 * a bare 10-digit number gets "1" prepended; anything else is passed
 * through as-is (best effort — a customer with an international number can
 * still fix it in the popup this button falls back to).
 */
function formatPhoneForWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

function buildWhatsAppUrl(phone: string, message: string): string {
  const formatted = formatPhoneForWhatsApp(phone);
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

export function SendWhatsAppButton({
  initialPhone,
  customerName,
  invoiceNumber,
  shopName,
  pdfUrl,
}: {
  initialPhone: string | null;
  customerName: string | null;
  invoiceNumber: string;
  shopName: string;
  pdfUrl: string;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [phone, setPhone] = useState("");

  const message = `Hi${customerName ? ` ${customerName}` : ""}, here's your invoice ${invoiceNumber} from ${shopName}: ${pdfUrl}`;

  function handleClick() {
    if (initialPhone && initialPhone.trim()) {
      window.open(buildWhatsAppUrl(initialPhone, message), "_blank", "noopener,noreferrer");
      return;
    }
    setShowPopup(true);
  }

  function handlePopupSend() {
    if (!phone.trim()) return;
    window.open(buildWhatsAppUrl(phone, message), "_blank", "noopener,noreferrer");
    setShowPopup(false);
    setPhone("");
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-slate-50"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
      >
        Send on WhatsApp
      </button>

      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowPopup(false)}>
          <div
            className="w-full max-w-sm rounded-xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              No number on file
            </h3>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              {customerName ? `${customerName} doesn't` : "This invoice doesn't"} have a phone number saved. Enter one to send this
              invoice on WhatsApp — it&apos;s used just for this message, not saved to the customer&apos;s record.
            </p>
            <label htmlFor="whatsapp-phone" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              WhatsApp Number
            </label>
            <input
              id="whatsapp-phone"
              type="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePopupSend()}
              placeholder="(902) 555-0100"
              className="w-full px-3 py-2 rounded-lg text-xs font-medium mb-4"
              style={inputStyle}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPopup(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePopupSend}
                disabled={!phone.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
