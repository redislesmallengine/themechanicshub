"use client";

import { useState, useTransition } from "react";
import { saveEmailSettings, sendTestEmail, clearEmailProvider } from "@/app/(app)/settings/email/actions";
import type { EmailProvider } from "@/lib/email";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

type Usage = Record<EmailProvider, { used: number; limit: number; window: "day" | "month" }>;

function UsageBar({ used, limit, window }: { used: number; limit: number; window: "day" | "month" }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? "var(--color-error-solid)" : pct >= 60 ? "var(--color-warning-solid)" : "var(--color-success-solid)";
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>
        <span>
          {used.toLocaleString()} / {limit.toLocaleString()} this {window}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "var(--bg-surface-subtle)" }}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ProviderCard({
  title,
  badge,
  connected,
  usage,
  onDisconnect,
  disconnecting,
  children,
}: {
  title: string;
  badge: string;
  connected: boolean;
  usage?: { used: number; limit: number; window: "day" | "month" };
  onDisconnect: () => void;
  disconnecting: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg p-4" style={{ border: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            {title}
          </span>
          {connected ? (
            <span className="dt-badge dt-badge--success">
              <span className="dt-badge-dot" />
              Connected
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ color: "var(--text-muted)", background: "var(--bg-surface-subtle)" }}>
              Not connected
            </span>
          )}
        </div>
        {connected && (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={disconnecting}
            className="text-[11px] font-semibold disabled:opacity-50"
            style={{ color: "var(--color-error-solid)" }}
          >
            {disconnecting ? "…" : "Disconnect"}
          </button>
        )}
      </div>
      <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
        {badge}
      </p>
      {children}
      {connected && usage && <UsageBar used={usage.used} limit={usage.limit} window={usage.window} />}
    </div>
  );
}

export function EmailSettingsForm({
  initialFromName,
  initialFromEmail,
  connected,
  usage,
}: {
  initialFromName: string;
  initialFromEmail: string;
  connected: Record<EmailProvider, boolean>;
  usage: Usage;
}) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testMessage, setTestMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState<EmailProvider | null>(null);
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startSaving(async () => {
      const result = await saveEmailSettings(formData);
      setMessage(result?.error ? { type: "error", text: result.error } : { type: "success", text: "Email settings saved." });
    });
  }

  function handleTest() {
    setTestMessage(null);
    startTesting(async () => {
      const result = await sendTestEmail();
      setTestMessage(
        result?.error ? { type: "error", text: result.error } : { type: "success", text: "Test email sent — check your inbox." }
      );
    });
  }

  async function handleDisconnect(provider: EmailProvider) {
    if (!confirm(`Disconnect ${provider}? Sending will skip straight to the next provider in line.`)) return;
    setDisconnecting(provider);
    await clearEmailProvider(provider);
    setDisconnecting(null);
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
            Outbound Email
          </h3>
        </div>
        <span className="text-[11px] text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200 font-mono">
          Settings
        </span>
      </div>

      <div
        className="p-3 rounded-lg text-xs"
        style={{ background: "var(--color-info-subtle)", border: "1px solid var(--color-info-border)", color: "var(--color-info-text)" }}
      >
        Connect as many as you like — sending goes <b>Resend → SendGrid → SMTP</b> in that order, moving to the next one
        automatically once the current one is out of free quota (or fails). Leave any section&apos;s fields blank to keep what&apos;s
        already saved there.
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

      <div className="space-y-3">
        <ProviderCard
          title="1. Resend"
          badge="Tried first. Free tier: 3,000/month."
          connected={connected.resend}
          usage={usage.resend}
          onDisconnect={() => handleDisconnect("resend")}
          disconnecting={disconnecting === "resend"}
        >
          <input
            name="resendApiKey"
            type="password"
            placeholder={connected.resend ? "•••••••••••••••• (leave blank to keep current)" : "re_..."}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono"
            style={inputStyle}
          />
        </ProviderCard>

        <ProviderCard
          title="2. SendGrid"
          badge="Tried once Resend is exhausted. Free tier: 100/day."
          connected={connected.sendgrid}
          usage={usage.sendgrid}
          onDisconnect={() => handleDisconnect("sendgrid")}
          disconnecting={disconnecting === "sendgrid"}
        >
          <input
            name="sendgridApiKey"
            type="password"
            placeholder={connected.sendgrid ? "•••••••••••••••• (leave blank to keep current)" : "SG...."}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono"
            style={inputStyle}
          />
        </ProviderCard>

        <ProviderCard
          title="3. SMTP (Hostinger, or any mailbox)"
          badge="Last resort. Falls back further to the platform default if this isn't set either."
          connected={connected.smtp}
          usage={usage.smtp}
          onDisconnect={() => handleDisconnect("smtp")}
          disconnecting={disconnecting === "smtp"}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input name="smtpHost" type="text" placeholder="smtp.hostinger.com" className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
            <input name="smtpPort" type="number" defaultValue={465} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
            <input name="smtpUser" type="text" placeholder="noreply@yourshop.com" className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
            <input
              name="smtpPassword"
              type="password"
              placeholder={connected.smtp ? "•••••••• (keep current)" : "password"}
              className="w-full px-3 py-2 rounded-lg text-xs"
              style={inputStyle}
            />
          </div>
        </ProviderCard>
      </div>

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
