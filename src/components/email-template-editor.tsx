"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveEmailTemplate, restoreDefaultTemplate, previewEmailTemplate } from "@/app/(app)/settings/email-templates/actions";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export interface EmailTemplateData {
  key: string;
  label: string;
  description: string;
  tokens: { token: string; description: string }[];
  requiredTokens: string[];
  subject: string;
  html: string;
  isCustom: boolean;
}

export function EmailTemplateEditor({ templates }: { templates: EmailTemplateData[] }) {
  const [activeKey, setActiveKey] = useState(templates[0]?.key ?? "");
  const active = templates.find((t) => t.key === activeKey);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">
      <div className="space-y-1">
        {templates.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveKey(t.key)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-bold text-left transition"
            style={
              t.key === activeKey
                ? { background: "var(--color-brand-600)", color: "#fff" }
                : { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }
            }
          >
            {t.label}
            {t.isCustom && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                style={t.key === activeKey ? { background: "rgba(255,255,255,0.25)" } : { background: "var(--color-success-subtle)", color: "var(--color-success-text)" }}
              >
                Customized
              </span>
            )}
          </button>
        ))}
      </div>
      {active && <TemplatePanel key={active.key} template={active} />}
    </div>
  );
}

function TemplatePanel({ template }: { template: EmailTemplateData }) {
  const router = useRouter();
  const richTextEditorRef = useRef<RichTextEditorHandle>(null);
  const rawHtmlRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastFocused = useRef<"subject" | "html">("html");
  const [showRawHtml, setShowRawHtml] = useState(false);

  const [subject, setSubject] = useState(template.subject);
  const [html, setHtml] = useState(template.html);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  const [pendingSave, startSave] = useTransition();
  const [pendingPreview, startPreview] = useTransition();
  const [pendingRestore, startRestore] = useTransition();

  const boundSave = saveEmailTemplate.bind(null, template.key);
  const boundPreview = previewEmailTemplate.bind(null, template.key);
  const boundRestore = restoreDefaultTemplate.bind(null, template.key);

  function insertToken(token: string) {
    const placeholder = `{{${token}}}`;
    if (lastFocused.current === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? subject.length;
      const end = el.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + placeholder + subject.slice(end);
      setSubject(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + placeholder.length, start + placeholder.length);
      });
    } else if (showRawHtml && rawHtmlRef.current) {
      const el = rawHtmlRef.current;
      const start = el.selectionStart ?? html.length;
      const end = el.selectionEnd ?? html.length;
      const next = html.slice(0, start) + placeholder + html.slice(end);
      setHtml(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + placeholder.length, start + placeholder.length);
      });
    } else {
      richTextEditorRef.current?.insertAtCursor(placeholder);
    }
  }

  function handleSave(formData: FormData) {
    setMessage(null);
    startSave(async () => {
      const result = await boundSave(formData);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "Saved — this is what sends from now on." });
      router.refresh();
    });
  }

  function handlePreview() {
    setMessage(null);
    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("html", html);
    startPreview(async () => {
      const result = await boundPreview(formData);
      if (result?.error || !result.subject || !result.html) {
        setMessage({ type: "error", text: result?.error ?? "Couldn't load the preview." });
        return;
      }
      setPreview({ subject: result.subject, html: result.html });
    });
  }

  function handleRestore() {
    if (!confirm(`Restore the default "${template.label}" template? Your customized version will be permanently lost.`)) return;
    setMessage(null);
    startRestore(async () => {
      const result = await boundRestore();
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
      <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            {template.label}
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {template.description}
          </p>
        </div>
        {template.isCustom && (
          <button type="button" onClick={handleRestore} disabled={pendingRestore} className="text-[11px] font-bold shrink-0 disabled:opacity-50" style={{ color: "var(--color-error-solid)" }}>
            {pendingRestore ? "…" : "Restore Default"}
          </button>
        )}
      </div>

      <form action={handleSave} className="space-y-3">
        <div>
          <label htmlFor={`subject-${template.key}`} className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Subject
          </label>
          <input
            ref={subjectRef}
            id={`subject-${template.key}`}
            name="subject"
            type="text"
            value={subject}
            onFocus={() => (lastFocused.current = "subject")}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor={`html-${template.key}`} className="block font-bold text-xs" style={{ color: "var(--text-secondary)" }}>
              Email Body
            </label>
            <button
              type="button"
              onClick={() => setShowRawHtml((v) => !v)}
              className="text-[10px] font-bold underline underline-offset-2"
              style={{ color: "var(--text-muted)" }}
            >
              {showRawHtml ? "Back to visual editor" : "Edit HTML directly"}
            </button>
          </div>
          {showRawHtml ? (
            <textarea
              ref={rawHtmlRef}
              id={`html-${template.key}`}
              rows={12}
              value={html}
              onFocus={() => (lastFocused.current = "html")}
              onChange={(e) => setHtml(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono leading-relaxed"
              style={inputStyle}
            />
          ) : (
            <RichTextEditor ref={richTextEditorRef} id={`html-${template.key}`} value={html} onChange={setHtml} onFocus={() => (lastFocused.current = "html")} />
          )}
          <input type="hidden" name="html" value={html} />
        </div>

        <div className="p-3 rounded-lg" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-[11px] font-bold mb-2" style={{ color: "var(--text-secondary)" }}>
            Available placeholders — click to insert where you last clicked
          </p>
          <div className="flex flex-wrap gap-1.5">
            {template.tokens.map((t) => {
              const required = template.requiredTokens.includes(t.token);
              return (
                <button
                  key={t.token}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertToken(t.token)}
                  title={t.description}
                  className="px-2 py-1 rounded text-[10px] font-mono font-semibold transition hover:bg-slate-50"
                  style={{ background: "var(--bg-surface)", border: `1px solid ${required ? "var(--color-warning-border)" : "var(--border-strong)"}`, color: "var(--text-primary)" }}
                >
                  {`{{${t.token}}}`}
                  {required && (
                    <span className="ml-0.5" style={{ color: "var(--color-warning-solid)" }}>
                      *
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {template.requiredTokens.length > 0 && (
            <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
              * required — the template must keep this placeholder, or the email won&apos;t let the customer actually do anything.
            </p>
          )}
        </div>

        {message && (
          <p className="text-xs font-semibold" style={{ color: message.type === "error" ? "var(--color-error-solid)" : "var(--color-success-solid)" }}>
            {message.text}
          </p>
        )}

        <div className="pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button
            type="button"
            onClick={handlePreview}
            disabled={pendingPreview}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
          >
            {pendingPreview ? "Loading…" : "Preview"}
          </button>
          <button type="submit" disabled={pendingSave} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60">
            {pendingSave ? "Saving…" : "Save Template"}
          </button>
        </div>
      </form>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setPreview(null)}>
          <div
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {preview.subject}
              </h3>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                Rendered with sample data — real emails use the actual customer/shop details.
              </p>
            </div>
            <iframe title="Template preview" srcDoc={preview.html} sandbox="" className="flex-1 w-full bg-white" />
            <div className="p-4 flex items-center justify-end" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
