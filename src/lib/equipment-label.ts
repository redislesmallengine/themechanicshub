// How a piece of equipment is written everywhere it is shown or picked from a list: the type first, then the make and model
// ("Snowblower — Ariens 921022"). One place, so the type never goes missing from one screen.

type EquipmentLike = {
  make?: string | null;
  model?: string | null;
  equipmentType?: { name: string } | null;
};

/** "Yardworks Briggs 7.25" */
export function equipmentMakeModel(eq: EquipmentLike): string {
  return [eq.make, eq.model].map((s) => s?.trim()).filter(Boolean).join(" ");
}

/** "Push Lawn Mower", or "" when no type was chosen. */
export function equipmentTypeName(eq: EquipmentLike): string {
  return eq.equipmentType?.name?.trim() ?? "";
}

/** "Push Lawn Mower — Yardworks Briggs 7.25"; whichever half is missing is simply left out; `fallback` when both are. */
export function describeEquipment(eq: EquipmentLike, fallback = "Equipment"): string {
  const type = equipmentTypeName(eq);
  const detail = equipmentMakeModel(eq);
  if (type && detail) return `${type} — ${detail}`;
  return type || detail || fallback;
}

// A merged invoice names each machine on a heading line: the type on the first line, then the make, model and work order
// on the second. Older headings are a single line and are shown as they were saved.
export function splitMachineHeading(description: string): { title: string; subtitle: string | null } {
  const i = description.indexOf("\n");
  if (i === -1) return { title: description, subtitle: null };
  return { title: description.slice(0, i), subtitle: description.slice(i + 1) || null };
}

/** The heading line saved for one machine of a merged invoice. */
export function machineHeading(eq: EquipmentLike, workOrderNumber: string): string {
  const type = equipmentTypeName(eq);
  const detail = equipmentMakeModel(eq);
  const tail = detail ? `${detail} · ${workOrderNumber}` : workOrderNumber;
  return type ? `${type}\n${tail}` : `${detail || "Equipment"}\n${workOrderNumber}`;
}
