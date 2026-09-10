"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEquipment, uploadEquipmentPhotoAction, removeEquipmentPhoto } from "@/app/(app)/equipment/actions";
import { ImageUploader } from "@/components/image-uploader";
import { InventoryIcon } from "@/components/icons";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

const ENGINE_TYPES = ["2-stroke", "4-stroke", "Electric", "Battery"];

export function EquipmentEditForm({
  equipmentId,
  hasPhoto,
  equipmentTypes,
  initialEquipmentTypeId,
  initialMake,
  initialModel,
  initialSerialNumber,
  initialEngineType,
  initialDisplacement,
  initialYear,
  initialNotes,
}: {
  equipmentId: string;
  hasPhoto: boolean;
  equipmentTypes: { id: string; name: string }[];
  initialEquipmentTypeId: string;
  initialMake: string;
  initialModel: string;
  initialSerialNumber: string;
  initialEngineType: string;
  initialDisplacement: string;
  initialYear: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const boundUpdate = updateEquipment.bind(null, equipmentId);
  const boundUpload = uploadEquipmentPhotoAction.bind(null, equipmentId);
  const boundRemove = removeEquipmentPhoto.bind(null, equipmentId);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await boundUpdate(formData);
      // updateEquipment redirects on success, so reaching here means it didn't
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-brand-500/80 shadow-md p-5" style={{ background: "var(--bg-surface)" }}>
        <div className="font-bold text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          Photo
        </div>
        <ImageUploader
          imageSrc={hasPhoto ? `/api/equipment-photo/${equipmentId}` : null}
          uploadLabel="Upload Photo"
          changeLabel="Change Photo"
          placeholder="No photo"
          onUpload={(file) => {
            const formData = new FormData();
            formData.set("photo", file);
            return boundUpload(formData);
          }}
          onRemove={boundRemove}
        />
      </div>

      <form action={handleSubmit} className="rounded-xl border-2 border-brand-500/80 shadow-md p-5 space-y-4" style={{ background: "var(--bg-surface)" }}>
        <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-brand-50 text-brand-600">
              <InventoryIcon className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
              Edit Equipment
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label htmlFor="equipmentTypeId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Type
            </label>
            <select id="equipmentTypeId" name="equipmentTypeId" defaultValue={initialEquipmentTypeId} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
              <option value="">Select…</option>
              {equipmentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="make" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Make
            </label>
            <input id="make" name="make" type="text" list="common-makes" defaultValue={initialMake} placeholder="Honda" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
            <datalist id="common-makes">
              {["Honda", "Briggs & Stratton", "Toro", "Husqvarna", "Stihl", "MTD", "Craftsman", "Kohler", "Yamaha", "Mercury"].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="model" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Model
            </label>
            <input id="model" name="model" type="text" defaultValue={initialModel} placeholder="HRX217" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
          </div>

          <div>
            <label htmlFor="serialNumber" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Serial Number
            </label>
            <input id="serialNumber" name="serialNumber" type="text" defaultValue={initialSerialNumber} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="engineType" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Engine Type
            </label>
            <select id="engineType" name="engineType" defaultValue={initialEngineType} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
              <option value="">Select…</option>
              {ENGINE_TYPES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="displacement" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Displacement / HP
            </label>
            <input
              id="displacement"
              name="displacement"
              type="text"
              defaultValue={initialDisplacement}
              placeholder="42cc or 11 HP"
              className="w-full px-3 py-2 rounded-lg text-xs font-medium"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="year" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Year
            </label>
            <input
              id="year"
              name="year"
              type="number"
              min="1900"
              max={new Date().getFullYear() + 1}
              defaultValue={initialYear}
              placeholder="2019"
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
              style={inputStyle}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="notes" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Intake Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={1}
              defaultValue={initialNotes}
              placeholder="Condition, visible damage, accessories included…"
              className="w-full px-3 py-2 rounded-lg text-xs font-medium"
              style={inputStyle}
            />
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
            onClick={() => router.push(`/equipment/${equipmentId}`)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button type="submit" disabled={pending} className="px-5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60">
            {pending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
