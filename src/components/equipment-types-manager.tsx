"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addEquipmentType, renameEquipmentType, deleteEquipmentType } from "@/app/(app)/settings/equipment-types/actions";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

interface EquipmentTypeRow {
  id: string;
  name: string;
  count: number;
}

function TypeRow({ type }: { type: EquipmentTypeRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(type.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  function handleSave() {
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    startSaving(async () => {
      const result = await renameEquipmentType(type.id, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${type.name}"?`)) return;
    startDeleting(async () => {
      const result = await deleteEquipmentType(type.id);
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
                setName(type.name);
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
            {type.name}
          </span>
        )}
        {error && (
          <p className="text-[11px] font-semibold mt-1" style={{ color: "var(--color-error-solid)" }}>
            {error}
          </p>
        )}
      </td>
      <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
        {type.count}
      </td>
      <td className="dt-td text-right">
        {!editing && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-3">
            <button onClick={() => setEditing(true)} className="text-[11px] font-bold text-brand-600">
              Rename
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || type.count > 0}
              title={type.count > 0 ? "In use — reassign equipment off this type first" : "Delete"}
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

export function EquipmentTypesManager({ types }: { types: EquipmentTypeRow[] }) {
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
      const result = await addEquipmentType(formData);
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
          <label htmlFor="newType" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Add a Type
          </label>
          <input
            id="newType"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Zero-Turn Mower"
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
                <th className="dt-th text-left">Type</th>
                <th className="dt-th text-left">In Use</th>
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <TypeRow key={type.id} type={type} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
