"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSavedView, deleteSavedView } from "@/app/(app)/inventory/actions";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export interface SavedViewItem {
  id: string;
  name: string;
  href: string;
  active: boolean;
}

function ViewPill({ view }: { view: SavedViewItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete the "${view.name}" view? This can't be undone — anyone else using it loses the shortcut too.`)) return;
    startTransition(async () => {
      const result = await deleteSavedView(view.id);
      if (result?.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Link
      href={view.href}
      className="group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-bold transition"
      style={
        view.active
          ? { background: "var(--color-brand-600)", color: "#fff" }
          : { background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }
      }
    >
      ★ {view.name}
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        aria-label={`Delete ${view.name} view`}
        className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
        style={{ background: view.active ? "rgba(255,255,255,0.25)" : "var(--bg-surface)" }}
      >
        ×
      </button>
    </Link>
  );
}

export function SavedViewsBar({ views, currentFilters }: { views: SavedViewItem[]; currentFilters: { q?: string; category?: string; stock?: string } }) {
  const router = useRouter();
  const [showPopup, setShowPopup] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (!name.trim()) return;
    setError(null);
    const formData = new FormData();
    formData.set("name", name.trim());
    if (currentFilters.q) formData.set("q", currentFilters.q);
    if (currentFilters.category) formData.set("category", currentFilters.category);
    if (currentFilters.stock) formData.set("stock", currentFilters.stock);

    startTransition(async () => {
      const result = await createSavedView(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setShowPopup(false);
      setName("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {views.map((v) => (
        <ViewPill key={v.id} view={v} />
      ))}
      <button
        type="button"
        onClick={() => setShowPopup(true)}
        className="px-3 py-1.5 rounded-full text-xs font-bold transition"
        style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-strong)", color: "var(--text-muted)" }}
      >
        + Save current filters as a view
      </button>

      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowPopup(false)}>
          <div
            className="w-full max-w-sm rounded-xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              Save this view
            </h3>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Saves the current search, category, and stock filter as a one-click shortcut everyone on your team can use.
            </p>
            <label htmlFor="view-name" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              View Name
            </label>
            <input
              id="view-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="e.g. Belts Running Low"
              className="w-full px-3 py-2 rounded-lg text-xs font-medium mb-2"
              style={inputStyle}
            />
            {error && (
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-error-solid)" }}>
                {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 mt-2">
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
                onClick={handleSave}
                disabled={pending || !name.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save View"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
