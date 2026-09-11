"use client";

import { useRef, useState, useTransition } from "react";

type ActionResult = { success?: boolean; error?: string } | undefined;

/**
 * Reusable "photo" control — a button that opens the OS file dialog and
 * uploads immediately on selection (one click, one dialog, no separate
 * confirm step). Originally built for the shop logo (Settings -> Shop
 * Profile) after the two-control version confused people into thinking
 * nothing happened when they clicked "Upload"; reused here for equipment
 * photos too rather than re-solving the same problem twice.
 */
export function ImageUploader({
  imageSrc,
  onUpload,
  onRemove,
  uploadLabel = "Upload Photo",
  changeLabel = "Change Photo",
  placeholder = "No photo",
  size = "w-16 h-16",
  hint,
}: {
  imageSrc: string | null;
  onUpload: (file: File) => Promise<ActionResult>;
  onRemove?: (() => Promise<ActionResult>) | null;
  uploadLabel?: string;
  changeLabel?: string;
  placeholder?: string;
  size?: string;
  /** Recommended size/format text shown under the controls — e.g. dimensions and file size limits, so people don't have to guess before picking a file. */
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [currentSrc, setCurrentSrc] = useState(imageSrc);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploading, startUploading] = useTransition();
  const [removing, startRemoving] = useTransition();

  function handleChooseFile() {
    fileRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);
    const preview = URL.createObjectURL(file);
    startUploading(async () => {
      const result = await onUpload(file);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setCurrentSrc(preview); // the file we just sent is the new canonical image — no need to re-fetch from the server
      setMessage({ type: "success", text: "Photo updated." });
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function handleRemove() {
    if (!onRemove || !confirm("Remove this photo?")) return;
    setMessage(null);
    startRemoving(async () => {
      const result = await onRemove();
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setCurrentSrc(null);
    });
  }

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div
        className={`${size} rounded-lg flex items-center justify-center shrink-0 overflow-hidden`}
        style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)" }}
      >
        {currentSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from our own streaming routes, not next/image-optimizable
          <img src={currentSrc} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] font-semibold text-center px-1" style={{ color: "var(--text-muted)" }}>
            {placeholder}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-[220px]">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleChooseFile}
            disabled={uploading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
          >
            {uploading ? "Uploading…" : currentSrc ? changeLabel : uploadLabel}
          </button>
          {onRemove && currentSrc && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="text-xs font-semibold disabled:opacity-50"
              style={{ color: "var(--color-error-solid)" }}
            >
              {removing ? "…" : "Remove"}
            </button>
          )}
        </div>
        {hint && !message && (
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            {hint}
          </p>
        )}
        {message && (
          <p className="text-[11px] mt-1 font-semibold" style={{ color: message.type === "error" ? "var(--color-error-solid)" : "var(--color-success-solid)" }}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
