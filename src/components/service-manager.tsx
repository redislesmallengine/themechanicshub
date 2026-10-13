"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addService, updateService, deleteService } from "@/app/(app)/settings/services/actions";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export interface ServiceItem {
  id: string;
  name: string;
  price: string;
  taxable: boolean;
  description: string | null;
  active: boolean;
}

type ActionResult = { success?: boolean; error?: string } | undefined;

function ServiceFields({ item, idPrefix }: { item?: ServiceItem; idPrefix: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_8rem] gap-3 text-xs">
      <div>
        <label htmlFor={`${idPrefix}-name`} className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
          Service
        </label>
        <input id={`${idPrefix}-name`} name="name" type="text" required defaultValue={item?.name ?? ""} placeholder="e.g. Snowblower Full Service" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-price`} className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
          Price ($)
        </label>
        <input id={`${idPrefix}-price`} name="price" type="number" step="0.01" min="0" required defaultValue={item?.price ?? ""} placeholder="180.00" className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-description`} className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
          What it includes (optional)
        </label>
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={2}
          defaultValue={item?.description ?? ""}
          placeholder="New oil, new spark plug, belts checked… Starts the job's work-performed notes."
          className="w-full px-3 py-2 rounded-lg text-xs font-medium"
          style={inputStyle}
        />
      </div>
      <div className="md:col-span-2 flex items-center gap-5">
        <label className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" name="taxable" defaultChecked={item ? item.taxable : true} style={{ accentColor: "#0F52BA" }} />
          Taxable (the price is before tax)
        </label>
        {item && (
          <label className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" name="active" defaultChecked={item.active} style={{ accentColor: "#0F52BA" }} />
            Show in the service picker
          </label>
        )}
      </div>
    </div>
  );
}

function EditRow({ item }: { item: ServiceItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          run(() => updateService(item.id, formData));
        }}
        className="rounded-xl p-4 space-y-3"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--color-brand-600)" }}
      >
        <ServiceFields item={item} idPrefix={`edit-${item.id}`} />
        {error && (
          <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-xl p-4 flex items-start gap-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", opacity: item.active ? 1 : 0.6 }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            {item.name}
          </span>
          {!item.taxable && <span className="dt-badge dt-badge--info">No tax</span>}
          {!item.active && <span className="dt-badge dt-badge--warning">Hidden</span>}
        </div>
        {item.description && (
          <p className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: "var(--text-muted)" }}>
            {item.description}
          </p>
        )}
        {error && (
          <p className="text-xs font-semibold mt-1" style={{ color: "var(--color-error-solid)" }}>
            {error}
          </p>
        )}
      </div>
      <div className="num font-extrabold text-sm" style={{ color: "var(--text-primary)" }}>
        ${item.price}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setEditing(true)} className="text-[11px] font-bold text-brand-600">
          Edit
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Delete "${item.name}"? Invoices that already used it keep their lines.`)) run(() => deleteService(item.id));
          }}
          className="text-[11px] font-bold disabled:opacity-60"
          style={{ color: "var(--color-error-solid)" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function ServiceManager({ items }: { items: ServiceItem[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-4">
      <form
        key={formKey}
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const result = await addService(formData);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setFormKey((k) => k + 1); // a fresh, empty form
            router.refresh();
          });
        }}
        className="rounded-xl p-4 space-y-3"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
      >
        <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Add a service
        </h2>
        <ServiceFields idPrefix="new" />
        {error && (
          <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {pending ? "Adding…" : "Add Service"}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No services yet. Add the jobs you do again and again, like a full service or a tune-up, with their price.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <EditRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
