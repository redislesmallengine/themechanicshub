"use client";

import { useRef, useState, useTransition } from "react";
import { saveShopProfile, uploadShopLogo, removeShopLogo } from "@/app/(app)/settings/shop/actions";
import { CANADIAN_PROVINCES } from "@/lib/provinces";
import { StoreIcon } from "@/components/icons";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

function LogoUploader({ organizationId, hasLogo }: { organizationId: string; hasLogo: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [logoVisible, setLogoVisible] = useState(hasLogo);
  // Cache-busting query param — only needs to change when the stored logo
  // actually changes, not on every render, so it's tracked as state (set
  // once via the lazy initializer, bumped after a successful upload)
  // rather than read impurely during render.
  const [cacheBust, setCacheBust] = useState(() => Date.now());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploading, startUploading] = useTransition();
  const [removing, startRemoving] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setMessage(null);
    const formData = new FormData();
    formData.set("logo", file);
    startUploading(async () => {
      const result = await uploadShopLogo(formData);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "Logo updated." });
      setLogoVisible(true);
      setCacheBust(Date.now());
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function handleRemove() {
    if (!confirm("Remove the shop logo?")) return;
    setMessage(null);
    startRemoving(async () => {
      await removeShopLogo();
      setLogoVisible(false);
      setPreview(null);
    });
  }

  const displaySrc = preview ?? (logoVisible ? `/api/shop-logo/${organizationId}?t=${cacheBust}` : null);

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div
        className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
        style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)" }}
      >
        {displaySrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from our own streaming route (src/app/api/shop-logo), not next/image-optimizable
          <img src={displaySrc} alt="Shop logo" className="w-full h-full object-contain" />
        ) : (
          <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
            No logo
          </span>
        )}
      </div>
      <div className="flex-1 min-w-[220px]">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="text-xs" />
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          {logoVisible && (
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
        {message && (
          <p className="text-[11px] mt-1 font-semibold" style={{ color: message.type === "error" ? "var(--color-error-solid)" : "var(--color-success-solid)" }}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

export function ShopProfileForm({
  organizationId,
  initialName,
  initialAddress,
  initialPhone,
  initialLaborRate,
  initialDiagnosticFee,
  initialTaxRate,
  initialTaxLabel,
  initialProvince,
  hasLogo,
}: {
  organizationId: string;
  initialName: string;
  initialAddress: string;
  initialPhone: string;
  initialLaborRate: string;
  initialDiagnosticFee: string;
  initialTaxRate: string;
  initialTaxLabel: string;
  initialProvince: string;
  hasLogo: boolean;
}) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startSaving(async () => {
      const result = await saveShopProfile(formData);
      setMessage(result?.error ? { type: "error", text: result.error } : { type: "success", text: "Shop profile saved." });
    });
  }

  return (
    <form
      action={handleSubmit}
      className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-5"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-brand-50 text-brand-600">
            <StoreIcon className="w-4 h-4" />
          </span>
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            Shop Details
          </h3>
        </div>
        <span className="text-[11px] text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200 font-mono">
          Settings
        </span>
      </div>

      <div>
        <div className="font-bold text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          Logo
        </div>
        <LogoUploader organizationId={organizationId} hasLogo={hasLogo} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label htmlFor="name" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Shop Name
          </label>
          <input id="name" name="name" type="text" required defaultValue={initialName} className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="phone" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Phone
          </label>
          <input id="phone" name="phone" type="tel" defaultValue={initialPhone} placeholder="(902) 555-0100" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="address" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Address
          </label>
          <input
            id="address"
            name="address"
            type="text"
            defaultValue={initialAddress}
            placeholder="123 Main St, Montague, PE"
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <div className="font-bold text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          Billing Defaults
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="laborRate" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Labor Rate ($/hr)
            </label>
            <input
              id="laborRate"
              name="laborRate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initialLaborRate}
              placeholder="95.00"
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="diagnosticFee" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Diagnostic Fee ($)
            </label>
            <input
              id="diagnosticFee"
              name="diagnosticFee"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initialDiagnosticFee}
              placeholder="45.00"
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
              style={inputStyle}
            />
          </div>
        </div>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          Pulled onto every invoice automatically once invoicing (Phase 6) lands — leave blank to set them per-invoice for now.
        </p>
      </div>

      <div>
        <div className="font-bold text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          Tax Configuration
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label htmlFor="province" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Province
            </label>
            <select id="province" name="province" defaultValue={initialProvince} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
              <option value="">Select…</option>
              {CANADIAN_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="taxLabel" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Tax Label
            </label>
            <input id="taxLabel" name="taxLabel" type="text" defaultValue={initialTaxLabel} placeholder="HST" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="taxRate" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Tax Rate (%)
            </label>
            <input
              id="taxRate"
              name="taxRate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initialTaxRate}
              placeholder="15.00"
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
              style={inputStyle}
            />
          </div>
        </div>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          Double-check your current provincial/federal rate before saving — this isn&apos;t tax advice, just where invoicing will pull it from.
        </p>
      </div>

      {message && (
        <p className="text-xs font-semibold" style={{ color: message.type === "error" ? "var(--color-error-solid)" : "var(--color-success-solid)" }}>
          {message.text}
        </p>
      )}

      <div className="pt-3 flex items-center justify-end" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button type="submit" disabled={saving} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60">
          {saving ? "Saving…" : "Save Shop Profile"}
        </button>
      </div>
    </form>
  );
}
