"use client";

import { useState, useTransition } from "react";
import { saveShopProfile, uploadShopLogo, removeShopLogo } from "@/app/(app)/settings/shop/actions";
import { CANADIAN_PROVINCES, US_STATES } from "@/lib/provinces";
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
  initialEmail,
  initialWebsite,
  initialLabourRate,
  initialDiagnosticFee,
  initialDeliveryFee,
  initialTaxes,
  initialCountry,
  initialProvince,
  initialAgingAlertDays,
  initialNewJobMode,
  initialFacebookUrl,
  initialGoogleReviewUrl,
  initialHstNumber,
  initialInvoiceReplyToEmail,
  hasLogo,
}: {
  organizationId: string;
  initialName: string;
  initialAddress: string;
  initialPhone: string;
  initialEmail: string;
  initialWebsite: string;
  initialLabourRate: string;
  initialDiagnosticFee: string;
  initialDeliveryFee: string;
  /** The shop's taxes, one row each. A shop with a single tax has one row. */
  initialTaxes: { name: string; rate: string }[];
  initialCountry: "CA" | "US";
  initialProvince: string;
  initialAgingAlertDays: string;
  initialNewJobMode: string;
  initialFacebookUrl: string;
  initialGoogleReviewUrl: string;
  initialHstNumber: string;
  initialInvoiceReplyToEmail: string;
  hasLogo: boolean;
}) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [country, setCountry] = useState<"CA" | "US">(initialCountry);
  const [province, setProvince] = useState(initialProvince);
  const [taxes, setTaxes] = useState<{ name: string; rate: string }[]>(initialTaxes.length > 0 ? initialTaxes : [{ name: "", rate: "" }]);
  const us = country === "US";
  const multiple = taxes.length > 1;
  const setTax = (i: number, patch: Partial<{ name: string; rate: string }>) => setTaxes((cur) => cur.map((t, ti) => (ti === i ? { ...t, ...patch } : t)));

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
          <label htmlFor="email" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Shop Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={initialEmail}
            placeholder="info@yourshop.com"
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
          <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
            Optional — printed with your address and phone on invoices and receipts.
          </span>
        </div>
        <div>
          <label htmlFor="website" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Website
          </label>
          <input
            id="website"
            name="website"
            type="text"
            defaultValue={initialWebsite}
            placeholder="www.yourshop.com"
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
          <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
            Optional — printed with your address and phone on invoices and receipts.
          </span>
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
      </div>

      <div>
        <div className="font-bold text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          Billing Defaults
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
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
          <div>
            <label htmlFor="deliveryFee" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Pickup / Delivery Fee ($)
            </label>
            <input
              id="deliveryFee"
              name="deliveryFee"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initialDeliveryFee}
              placeholder="Optional"
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
              style={inputStyle}
            />
          </div>
        </div>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          Pulled onto every invoice automatically. Delivery fee is optional — leave blank if you don&apos;t offer pickup/delivery; once set, Generate Invoice will suggest it on any work order marked Shop Pickup/Delivery.
        </p>
        <div className="mt-3">
          <label htmlFor="invoiceReplyToEmail" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Reply-To Email Address for Invoice
          </label>
          <input
            id="invoiceReplyToEmail"
            name="invoiceReplyToEmail"
            type="email"
            defaultValue={initialInvoiceReplyToEmail}
            placeholder="billing@yourshop.com"
            className="w-full max-w-sm px-3 py-2 rounded-lg text-xs font-medium"
            style={inputStyle}
          />
          <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
            Optional — when a customer hits Reply on an invoice email, it goes here instead of wherever the email actually sent
            from. Leave blank to use the sending address.
          </span>
        </div>
      </div>

      <div>
        <div className="font-bold text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          Tax Configuration
        </div>
        <input type="hidden" name="country" value={country} />
        <input type="hidden" name="taxes" value={JSON.stringify(taxes)} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label htmlFor="country" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Country <span style={{ color: "var(--color-error-solid)" }}>*</span>
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value as "CA" | "US");
                setProvince("");
              }}
              className="w-full px-3 py-2 rounded-lg text-xs font-semibold"
              style={inputStyle}
            >
              <option value="CA">Canada</option>
              <option value="US">United States</option>
            </select>
          </div>
          <div>
            <label htmlFor="province" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              {us ? "State" : "Province"} <span style={{ color: "var(--color-error-solid)" }}>*</span>
            </label>
            <select id="province" name="province" required value={province} onChange={(e) => setProvince(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
              <option value="" disabled>
                Select…
              </option>
              {(us ? US_STATES : CANADIAN_PROVINCES).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          {!multiple ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="tax-name-0" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Tax Label <span style={{ color: "var(--color-error-solid)" }}>*</span>
                </label>
                <input id="tax-name-0" type="text" required value={taxes[0].name} onChange={(e) => setTax(0, { name: e.target.value })} placeholder={us ? "Sales tax" : "HST"} className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="tax-rate-0" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Tax Rate (%) <span style={{ color: "var(--color-error-solid)" }}>*</span>
                </label>
                <input id="tax-rate-0" type="number" step="0.01" min="0" required value={taxes[0].rate} onChange={(e) => setTax(0, { rate: e.target.value })} placeholder={us ? "8.25" : "15.00"} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="font-bold" style={{ color: "var(--text-secondary)" }}>
                Taxes on every invoice
              </div>
              {taxes.map((t, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,.7fr)_auto] gap-3 items-end">
                  <div>
                    <label htmlFor={`tax-name-${i}`} className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
                      Name
                    </label>
                    <input id={`tax-name-${i}`} type="text" required value={t.name} onChange={(e) => setTax(i, { name: e.target.value })} placeholder={us ? "County" : "PST"} className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
                  </div>
                  <div>
                    <label htmlFor={`tax-rate-${i}`} className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
                      Rate (%)
                    </label>
                    <input id={`tax-rate-${i}`} type="number" step="0.01" min="0" required value={t.rate} onChange={(e) => setTax(i, { rate: e.target.value })} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
                  </div>
                  <button type="button" onClick={() => setTaxes((cur) => cur.filter((_, ti) => ti !== i))} className="px-2 py-2 text-xs font-bold" style={{ color: "var(--color-error-solid)" }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={() => setTaxes((cur) => [...cur, { name: "", rate: "" }])} className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-brand-600 border border-[var(--color-brand-600)] bg-[var(--bg-surface)]">
              + Add another tax
            </button>
            <span style={{ color: "var(--text-muted)" }}>{multiple ? "Each tax appears on its own line on invoices and reports. All of them apply to labour and parts." : "Only needed if you file more than one tax separately."}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label htmlFor="hstNumber" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              {us ? "Tax permit number (optional)" : "Government Tax # (HST/GST)"}
            </label>
            <input
              id="hstNumber"
              name="hstNumber"
              type="text"
              defaultValue={initialHstNumber}
              placeholder={us ? "32-1234567-8" : "123456789 RT0001"}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
              style={inputStyle}
            />
            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
              Optional — printed at the bottom of every invoice if set.
            </span>
          </div>
        </div>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          {us
            ? "Type your combined state and local rate, or one row for each tax you file separately. Check your state's revenue department for the current rate and for what is taxable. This isn't tax advice."
            : "Double-check your current provincial/federal rate before saving — this isn't tax advice, just where invoicing will pull it from."}
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
          <div>
            <label htmlFor="newJobMode" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Main button for a new job
            </label>
            <select id="newJobMode" name="newJobMode" defaultValue={initialNewJobMode === "quick" ? "quick" : "steps"} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
              <option value="steps">New Work Order (step by step)</option>
              <option value="quick">Quick Job (one screen, for the counter)</option>
            </select>
          </div>
        </div>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          Flags equipment still sitting at &ldquo;Ready&rdquo; past this many days, on the Work Orders board and dashboard.
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
