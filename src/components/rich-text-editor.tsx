"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";

export interface RichTextEditorHandle {
  insertAtCursor: (text: string) => void;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onFocus?: () => void;
  id?: string;
}

/**
 * A minimal WYSIWYG editor (bold/italic/underline/lists/links) built on
 * contentEditable + execCommand -- deliberately not a rich-text library, to
 * keep this app dependency-free. Good enough for email-body formatting; not
 * meant to grow into a general document editor.
 */
export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { value, onChange, onFocus, id },
  forwardedRef
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [activeMarks, setActiveMarks] = useState<Set<string>>(new Set());
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (switching templates, Restore Default) into
  // the DOM -- but only while the editor doesn't have focus, so a re-render
  // from our own onChange never clobbers what's mid-typing/cursor position.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  useEffect(() => {
    function handleSelectionChange() {
      if (document.activeElement === editorRef.current) updateActiveMarks();
    }
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  useImperativeHandle(forwardedRef, () => ({
    insertAtCursor(text: string) {
      editorRef.current?.focus();
      document.execCommand("insertText", false, text);
      emitChange();
    },
  }));

  function emitChange() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  function updateActiveMarks() {
    const marks = new Set<string>();
    try {
      if (document.queryCommandState("bold")) marks.add("bold");
      if (document.queryCommandState("italic")) marks.add("italic");
      if (document.queryCommandState("underline")) marks.add("underline");
      if (document.queryCommandState("insertUnorderedList")) marks.add("ul");
      if (document.queryCommandState("insertOrderedList")) marks.add("ol");
    } catch {
      // Unsupported in this browser -- toolbar just won't highlight, formatting still works.
    }
    setActiveMarks(marks);
  }

  function runCommand(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
    updateActiveMarks();
  }

  function saveSelectionRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelectionRange() {
    const range = savedRangeRef.current;
    const sel = window.getSelection();
    if (!range || !sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function openLinkPopover() {
    saveSelectionRange();
    let existingHref = "";
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode ?? null;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLAnchorElement) {
        existingHref = node.getAttribute("href") ?? "";
        break;
      }
      node = node.parentNode;
    }
    setLinkUrl(existingHref);
    setLinkPopoverOpen(true);
    requestAnimationFrame(() => linkInputRef.current?.focus());
  }

  function confirmLink() {
    const url = linkUrl.trim();
    editorRef.current?.focus();
    restoreSelectionRange();
    if (url) {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed) {
        // Nothing was selected -- insert the URL itself as visible, clickable text.
        document.execCommand("insertHTML", false, `<a href="${escapeHtmlAttr(url)}">${escapeHtml(url)}</a>`);
      } else {
        document.execCommand("createLink", false, url);
      }
    }
    emitChange();
    setLinkPopoverOpen(false);
  }

  function removeLink() {
    editorRef.current?.focus();
    restoreSelectionRange();
    document.execCommand("unlink");
    emitChange();
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-strong)" }}>
      <div
        className="flex flex-wrap items-center gap-0.5 px-2 py-1.5"
        style={{ background: "var(--bg-surface-subtle)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <ToolbarButton label="Bold" active={activeMarks.has("bold")} onClick={() => runCommand("bold")}>
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton label="Italic" active={activeMarks.has("italic")} onClick={() => runCommand("italic")}>
          <i>I</i>
        </ToolbarButton>
        <ToolbarButton label="Underline" active={activeMarks.has("underline")} onClick={() => runCommand("underline")}>
          <u>U</u>
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Bullet list" active={activeMarks.has("ul")} onClick={() => runCommand("insertUnorderedList")}>
          • List
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={activeMarks.has("ol")} onClick={() => runCommand("insertOrderedList")}>
          1. List
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Insert link" onClick={openLinkPopover}>
          Link
        </ToolbarButton>
        <ToolbarButton label="Remove link" onClick={removeLink}>
          Unlink
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Clear formatting" onClick={() => runCommand("removeFormat")}>
          Clear
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Undo" onClick={() => runCommand("undo")}>
          Undo
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => runCommand("redo")}>
          Redo
        </ToolbarButton>
      </div>

      {linkPopoverOpen && (
        <div
          className="flex items-center gap-2 px-2 py-2"
          style={{ background: "var(--bg-surface-subtle)", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <input
            ref={linkInputRef}
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmLink();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setLinkPopoverOpen(false);
              }
            }}
            placeholder="https://... or a placeholder like {{approval_link}}"
            className="flex-1 px-2 py-1 rounded text-xs font-mono"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
          />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={confirmLink} className="px-2.5 py-1 rounded text-xs font-bold text-white bg-brand-600">
            Insert
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setLinkPopoverOpen(false)}
            className="px-2.5 py-1 rounded text-xs font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </button>
        </div>
      )}

      <div
        ref={editorRef}
        id={id}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onFocus={onFocus}
        onBlur={saveSelectionRange}
        onMouseUp={updateActiveMarks}
        onKeyUp={updateActiveMarks}
        className="px-3 py-2.5 text-sm leading-relaxed min-h-[200px] max-h-[420px] overflow-y-auto focus:outline-none"
        style={{ background: "var(--bg-surface-subtle)", color: "var(--text-primary)" }}
      />
    </div>
  );
});

function ToolbarButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="px-2 py-1 rounded text-xs font-semibold transition"
      style={active ? { background: "var(--color-brand-600)", color: "#fff" } : { background: "transparent", color: "var(--text-secondary)" }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-4 mx-1 self-center" style={{ background: "var(--border-subtle)" }} />;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
