import { prisma } from "@/lib/prisma";

/** Starting point for a new shop's Equipment Types list (Settings -> Equipment Types) — editable/addable/deletable per-org from there afterward. */
export const DEFAULT_EQUIPMENT_TYPES = [
  "Lawn Mower",
  "Chainsaw",
  "Snowblower",
  "Generator",
  "ATV/UTV",
  "Outboard Motor",
  "Trimmer/Brushcutter",
  "Tiller",
  "Pressure Washer",
  "Other",
] as const;

/** Called once from organizationHooks.afterCreateOrganization (src/lib/auth.ts) so a brand-new shop isn't starting from an empty dropdown. */
export async function seedDefaultEquipmentTypes(organizationId: string) {
  await prisma.equipmentType.createMany({
    data: DEFAULT_EQUIPMENT_TYPES.map((name) => ({ organizationId, name })),
    skipDuplicates: true,
  });
}
