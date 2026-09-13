"use client";

import { useState, useTransition } from "react";
import { saveShopProfile, uploadShopLogo, removeShopLogo } from "@/app/(app)/settings/shop/actions";
import { CANADIAN_PROVINCES } from "@/lib/provinces";
import { StoreIcon } from "@/components/icons";
import { ImageUploader } from "@/components/image-uploader";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export function ShopProfileForm({
  organizationId,
  initialName,
  initialAddress,
  initialPhone,
  initialLabourRate,
  initialDiagnosticFee,
  initialTaxRate,
  initialTaxLabel,
  initialProvince,
  initialAgingAlertDays,
  initialFacebookUrl,
  initialGoogleReviewUrl,
  initialHstNumber,
  hasLogo,
}: {
  organizationId: string;
  initialName: string;
  initialAddress: string;
  initialPhone: string;
  initialLabourRate: string;
  initialDiagnosticFee: string;
  initialTaxRate: string;
  initialTaxLabel: string;
  initialProvince: string;
  initialAgingAlertDays: string;
  initialFacebookUrl: string;
  initialGoogleReviewUrl: string;
  initialHstNumber: string;
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
        <ImageUploader
          imageSrc={hasLogo ? `/api/shop-logo/${organizationId}` : null}
          uploadLabel="Upload Logo"
          changeLabel="Change Logo"
          placeholder="No logo"
          hint="Best results: a square or landscape PNG or JPG, at least 200×200px. Up to 4MB."
          onUpload={(file) => {
            const formData = new FormData();
            formData.set("logo", file);
            return uploadShopLogo(formData);
          }}
          onRemove={removeShopLogo}
        />
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
            Phone <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            defaultValue={initialPhone}
            placeholder="(902) 555-0100"
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="address" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Address <span style={{ color: "var(--color-error-solid)" }}>*</span>
          </label>
          <input
            id="address"
            name="address"
            type="text"
            required
            defaultValue={initialAddress}
            placeholder="123 Main St, Montague, PE"
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="facebookUrl" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Facebook Page
          </label>
          <input
            id="facebookUrl"
            name="facebookUrl"
            type="text"
            defaultValue={initialFacebookUrl}
            placeholder="facebook.com/yourshop"
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
          <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
            Optional — shown as a link on invoices if set.
          </span>
        </div>
        <div>
          <label htmlFor="googleReviewUrl" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Google Review Link
          </label>
          <input
            id="googleReviewUrl"
            name="googleReviewUrl"
            type="text"
            defaultValue={initialGoogleReviewUrl}
            placeholder="g.page/r/your-id/review"
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
          <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
            Optional — from your Google Business Profile&apos;s &ldquo;Ask for reviews&rdquo; link. Shown as a button on invoices.
          </span>
        </div>
        <div>
          <label htmlFor="hstNumber" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Government Tax # (HST/GST)
          </label>
          <input
            id="hstNumber"
            name="hstNumber"
            type="text"
            defaultValue={initialHstNumber}
            placeholder="123456789 RT0001"
            className="w-full px-3 py-2 rounded-lg text-xs font-mono"
            style={inputStyle}
          />
          <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
            Optional — printed at the bottom of every invoice if set.
          </span>
        </div>
      </div>

      <div>
        <div className="font-bold text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          Billing Defaults
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="labourRate" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Labour Rate ($/hr) <span style={{ color: "var(--color-error-solid)" }}>*</span>
            </label>
            <input
              id="labourRate"
              name="labourRate"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={initialLabourRate}
              placeholder="95.00"
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="diagnosticFee" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Diagnostic Fee ($) <span style={{ color: "var(--color-error-solid)" }}>*</span>
            </label>
            <input
              id="diagnosticFee"
              name="diagnosticFee"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={initialDiagnosticFee}
              placeholder="45.00"
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
              style={inputStyle}
            />
          </div>
        </div>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          Pulled onto every invoice automatically once invoicing (Phase 6) lands.
        </p>
      </div>

      <div>
        <div className="font-bold text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          Tax Configuration
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label htmlFor="province" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Province <span style={{ color: "var(--color-error-solid)" }}>*</span>
            </label>
            <select id="province" name="province" required defaultValue={initialProvince} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
              <option value="" disabled>
                Select…
              </option>
              {CANADIAN_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="taxLabel" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Tax Label <span style={{ color: "var(--color-error-solid)" }}>*</span>
            </label>
            <input
              id="taxLabel"
              name="taxLabel"
              type="text"
              required
              defaultValue={initialTaxLabel}
              placeholder="HST"
              className="w-full px-3 py-2 rounded-lg text-xs font-medium"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="taxRate" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Tax Rate (%) <span style={{ color: "var(--color-error-solid)" }}>*</span>
            </label>
            <input
              id="taxRate"
              name="taxRate"
              type="number"
              step="0.01"
              min="0"
              required
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

      <div>
        <div className="font-bold text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          Work Orders
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="agingAlertDays" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Aging Alert (days)
            </label>
            <input
              id="agingAlertDays"
              name="agingAlertDays"
              type="number"
              step="1"
              min="1"
              required
              defaultValue={initialAgingAlertDays}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
              style={inputStyle}
            />
          </div>
        </div>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          Flags equipment still sitting in &ldquo;Ready for Pickup&rdquo; past this many days, on the Work Orders board and dashboard.
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
