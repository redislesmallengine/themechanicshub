"use client";

import { useState, useTransition } from "react";
import { saveEmailSettings, sendTestEmail } from "@/app/(app)/settings/email/actions";
import type { EmailProvider } from "@/lib/email";

const PROVIDERS: { value: EmailProvider; label: string; blurb: string }[] = [
  { value: "resend", label: "Resend", blurb: "Free tier (3,000/mo), best fit for this app, built-in delivery tracking." },
  { value: "sendgrid", label: "SendGrid", blurb: "Free tier (100/day), the most established transactional provider." },
  { value: "smtp", label: "Hostinger Email (SMTP)", blurb: "Free mailbox already on your domain. Lower sending limit, no delivery tracking." },
];

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export function EmailSettingsForm({
  initialProvider,
  initialFromName,
  initialFromEmail,
  hasCredentials,
}: {
  initialProvider: EmailProvider;
  initialFromName: string;
  initialFromEmail: string;
  hasCredentials: boolean;
}) {
  const [provider, setProvider] = useState<EmailProvider>(initialProvider);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testMessage, setTestMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startSaving(async () => {
      const result = await saveEmailSettings(formData);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Email settings saved." });
      }
    });
  }

  function handleTest() {
    setTestMessage(null);
    startTesting(async () => {
      const result = await sendTestEmail();
      if (result?.error) {
        setTestMessage({ type: "error", text: result.error });
      } else {
        setTestMessage({ type: "success", text: "Test email sent — check your inbox." });
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-brand-50 text-brand-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M4 4h16v16H4z" />
              <path d="m4 6 8 7 8-7" />
            </svg>
          </span>
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            Outbound Email Provider
          </h3>
        </div>
        <span className="text-[11px] text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200 font-mono">
          Settings
        </span>
      </div>

      <div>
        <label className="block font-bold mb-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          Provider
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <label
              key={p.value}
              className="rounded-lg p-3 cursor-pointer text-xs"
              style={{
                border: provider === p.value ? "2px solid var(--color-brand-600, #0F52BA)" : "1px solid var(--border-strong)",
                background: provider === p.value ? "var(--bg-surface-selected)" : "var(--bg-surface)",
              }}
            >
              <input type="radio" name="provider" value={p.value} checked={provider === p.value} onChange={() => setProvider(p.value)} className="hidden" />
              <div className="font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                {p.label}
              </div>
              <div style={{ color: "var(--text-muted)" }}>{p.blurb}</div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label htmlFor="fromName" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            From Name
          </label>
          <input id="fromName" name="fromName" type="text" required defaultValue={initialFromName} placeholder="Red Isle Small Engine" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="fromEmail" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            From Email
          </label>
          <input id="fromEmail" name="fromEmail" type="email" required defaultValue={initialFromEmail} placeholder="noreply@redislesmallengine.com" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
      </div>

      {(provider === "resend" || provider === "sendgrid") && (
        <div className="text-xs">
          <label htmlFor="apiKey" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            API Key
          </label>
          <input
            id="apiKey"
            name="apiKey"
            type="password"
            placeholder={hasCredentials ? "•••••••••••••••• (leave blank to keep current)" : "re_... or SG...."}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono"
            style={inputStyle}
          />
          <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
            {provider === "resend" ? "From resend.com → API Keys." : "From SendGrid → Settings → API Keys."}
          </span>
        </div>
      )}

      {provider === "smtp" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label htmlFor="host" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              SMTP Host
            </label>
            <input id="host" name="host" type="text" placeholder="smtp.hostinger.com" className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="port" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Port
            </label>
            <input id="port" name="port" type="number" defaultValue={465} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="user" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Username
            </label>
            <input id="user" name="user" type="text" placeholder="noreply@redislesmallengine.com" className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="password" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder={hasCredentials ? "•••••••• (leave blank to keep current)" : ""}
              className="w-full px-3 py-2 rounded-lg text-xs"
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {message && (
        <p className="text-xs font-semibold" style={{ color: message.type === "error" ? "var(--color-error-solid)" : "var(--color-success-solid)" }}>
          {message.text}
        </p>
      )}

      <div className="pt-3 flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
          >
            {testing ? "Sending…" : "Send Test Email"}
          </button>
          {testMessage && (
            <span className="text-[11px] font-semibold" style={{ color: testMessage.type === "error" ? "var(--color-error-solid)" : "var(--color-success-solid)" }}>
              {testMessage.text}
            </span>
          )}
        </div>
        <button type="submit" disabled={saving} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60">
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
