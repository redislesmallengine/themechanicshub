"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { ShieldIcon } from "@/components/icons";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export function RoleForm({
  mode,
  initialLabel = "",
  initialDescription = "",
  initialPermissions = {},
  onSubmit,
}: {
  mode: "create" | "edit";
  initialLabel?: string;
  initialDescription?: string;
  initialPermissions?: Record<string, string[]>;
  onSubmit: (formData: FormData) => Promise<{ success?: boolean; error?: string } | undefined>;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const group of PERMISSION_GROUPS) {
      for (const action of group.actions) {
        init[`${group.resource}__${action.key}`] = initialPermissions[group.resource]?.includes(action.key) ?? false;
      }
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(cellKey: string) {
    setChecked((prev) => ({ ...prev, [cellKey]: !prev[cellKey] }));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    for (const [cellKey, isChecked] of Object.entries(checked)) {
      if (!isChecked) continue;
      const sep = cellKey.indexOf("__");
      const resource = cellKey.slice(0, sep);
      const action = cellKey.slice(sep + 2);
      formData.set(`perm__${resource}__${action}`, "on");
    }
    startTransition(async () => {
      const result = await onSubmit(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/admin/roles");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-brand-50 text-brand-600">
            <ShieldIcon className="w-4 h-4" />
          </span>
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            {mode === "create" ? "New Role" : "Edit Role"}
          </h3>
        </div>
        <span className="text-[11px] text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200 font-mono">Role Rights</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label htmlFor="label" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Role Name <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <input
            id="label"
            name="label"
            type="text"
            required
            defaultValue={initialLabel}
            placeholder="e.g. Night Shift Technician"
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="description" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Description
          </label>
          <input
            id="description"
            name="description"
            type="text"
            defaultValue={initialDescription}
            placeholder="Shown to admins when assigning this role"
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <div className="font-bold text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          Rights
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.resource} className="rounded-lg p-3" style={{ border: "1px solid var(--border-subtle)" }}>
              <div className="font-bold text-xs mb-2" style={{ color: "var(--text-primary)" }}>
                {group.label}
              </div>
              <div className="space-y-1.5">
                {group.actions.map((action) => {
                  const cellKey = `${group.resource}__${action.key}`;
                  return (
                    <label key={cellKey} className="flex items-center gap-2 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                      <input
                        type="checkbox"
                        checked={checked[cellKey] ?? false}
                        onChange={() => toggle(cellKey)}
                        className="rounded"
                        style={{ accentColor: "#0F52BA" }}
                      />
                      {action.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}

      <div className="pt-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => router.push("/admin/roles")}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60">
          {pending ? "Saving…" : mode === "create" ? "Create Role" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
