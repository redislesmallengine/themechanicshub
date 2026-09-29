"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

type ActionResult = { success?: boolean; error?: string } | undefined;

export interface WarrantyProviderItem {
  id: string;
  name: string;
  billingEmail: string | null;
  billingAddress: string | null;
  count: number;
}

/** Add / edit / delete warranty providers -- same shape as TaxonomyManager (Part Categories, etc.) but with billing email/address fields a plain name list doesn't need. */
export function WarrantyProviderManager({
  items,
  onAdd,
  onUpdate,
  onDelete,
}: {
  items: WarrantyProviderItem[];
  onAdd: (formData: FormData) => Promise<ActionResult>;
  onUpdate: (id: string, formData: FormData) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("billingEmail", billingEmail);
    formData.set("billingAddress", billingAddress);
    startAdding(async () => {
      const result = await onAdd(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setName("");
      setBillingEmail("");
      setBillingAddress("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <label htmlFor="newName" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Provider Name
          </label>
          <input id="newName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Briggs & Stratton Warranty" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="newEmail" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Billing Email
          </label>
          <input id="newEmail" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="claims@example.com" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="newAddress" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Billing Address
            </label>
            <input id="newAddress" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="PO Box, city, etc." className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
          </div>
          <button type="submit" disabled={adding || !name.trim()} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60 whitespace-nowrap">
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
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
                <th className="dt-th text-left">Provider</th>
                <th className="dt-th text-left">Billing Email</th>
                <th className="dt-th text-left">Billing Address</th>
                <th className="dt-th text-left">In Use</th>
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="dt-td text-center text-sm py-6" style={{ color: "var(--text-muted)" }}>
                    No warranty providers yet — add one above.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <ProviderRow key={item.id} item={item} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProviderRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: WarrantyProviderItem;
  onUpdate: (id: string, formData: FormData) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [billingEmail, setBillingEmail] = useState(item.billingEmail ?? "");
  const [billingAddress, setBillingAddress] = useState(item.billingAddress ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  function handleSave() {
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("billingEmail", billingEmail);
    formData.set("billingAddress", billingAddress);
    startSaving(async () => {
      const result = await onUpdate(item.id, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleCancel() {
    setEditing(false);
    setName(item.name);
    setBillingEmail(item.billingEmail ?? "");
    setBillingAddress(item.billingAddress ?? "");
    setError(null);
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

  if (editing) {
    return (
      <tr className="dt-row">
        <td className="dt-td" colSpan={3}>
          <div className="grid grid-cols-3 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="px-2 py-1 rounded text-xs font-medium" style={inputStyle} autoFocus />
            <input value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="Billing email" className="px-2 py-1 rounded text-xs font-medium" style={inputStyle} />
            <input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="Billing address" className="px-2 py-1 rounded text-xs font-medium" style={inputStyle} />
          </div>
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
          <div className="flex justify-end gap-3">
            <button onClick={handleSave} disabled={saving} className="text-[11px] font-bold text-brand-600 disabled:opacity-50">
              {saving ? "…" : "Save"}
            </button>
            <button onClick={handleCancel} className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="dt-row group">
      <td className="dt-td">
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          {item.name}
        </span>
      </td>
      <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
        {item.billingEmail ?? "—"}
      </td>
      <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
        {item.billingAddress ?? "—"}
      </td>
      <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
        {item.count}
      </td>
      <td className="dt-td text-right">
        <div className="flex justify-end gap-3">
          <button onClick={() => setEditing(true)} className="text-[11px] font-bold text-brand-600">
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || item.count > 0}
            title={item.count > 0 ? "In use — reassign invoices off this provider first" : "Delete"}
            className="text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: "var(--color-error-solid)" }}
          >
            {deleting ? "…" : "Delete"}
          </button>
        </div>
      </td>
    </tr>
  );
}
