"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

type ActionResult = { success?: boolean; error?: string } | undefined;

export interface TaxonomyItem {
  id: string;
  name: string;
  count: number;
}

/**
 * Generic "shop's own editable list" manager — add / rename / delete, each
 * row showing how many records currently use it (blocking delete while
 * count > 0). Originally built for Equipment Types, reused as-is for Part
 * Categories rather than duplicating the same table+row logic twice.
 */
export function TaxonomyManager({
  items,
  itemNoun,
  addPlaceholder,
  onAdd,
  onRename,
  onDelete,
}: {
  items: TaxonomyItem[];
  itemNoun: string;
  addPlaceholder: string;
  onAdd: (formData: FormData) => Promise<ActionResult>;
  onRename: (id: string, formData: FormData) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    startAdding(async () => {
      const result = await onAdd(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
      <form onSubmit={handleAdd} className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="newItem" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Add a {itemNoun}
          </label>
          <input
            id="newItem"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={addPlaceholder}
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
        </div>
        <button type="submit" disabled={adding || !name.trim()} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {adding ? "Adding…" : "Add"}
        </button>
      </form>
      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}

      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table">
            <thead className="dt-head">
              <tr>
                <th className="dt-th text-left">{itemNoun}</th>
                <th className="dt-th text-left">In Use</th>
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <TaxonomyRow key={item.id} item={item} itemNoun={itemNoun} onRename={onRename} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TaxonomyRow({
  item,
  itemNoun,
  onRename,
  onDelete,
}: {
  item: TaxonomyItem;
  itemNoun: string;
  onRename: (id: string, formData: FormData) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  function handleSave() {
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    startSaving(async () => {
      const result = await onRename(item.id, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${item.name}"?`)) return;
    startDeleting(async () => {
      const result = await onDelete(item.id);
      if (result?.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <tr className="dt-row group">
      <td className="dt-td">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-2 py-1 rounded text-xs font-medium"
              style={inputStyle}
              autoFocus
            />
            <button onClick={handleSave} disabled={saving} className="text-[11px] font-bold text-brand-600 disabled:opacity-50">
              {saving ? "…" : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setName(item.name);
                setError(null);
              }}
              className="text-[11px] font-semibold"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            {item.name}
          </span>
        )}
        {error && (
          <p className="text-[11px] font-semibold mt-1" style={{ color: "var(--color-error-solid)" }}>
            {error}
          </p>
        )}
      </td>
      <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
        {item.count}
      </td>
      <td className="dt-td text-right">
        {!editing && (
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditing(true)} className="text-[11px] font-bold text-brand-600">
              Rename
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || item.count > 0}
              title={item.count > 0 ? `In use — reassign ${itemNoun.toLowerCase()}s off this first` : "Delete"}
              className="text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: "var(--color-error-solid)" }}
            >
              {deleting ? "…" : "Delete"}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
