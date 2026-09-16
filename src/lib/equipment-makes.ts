import { prisma } from "@/lib/prisma";

/** Starting point for a new shop's Equipment Makes list (Settings -> Equipment Makes) — editable/addable/deletable per-org from there afterward. */
export const DEFAULT_EQUIPMENT_MAKES = ["Honda", "Briggs & Stratton", "Toro", "Husqvarna", "Stihl", "MTD", "Craftsman", "Kohler", "Yamaha", "Mercury"] as const;

/** Called once from organizationHooks.afterCreateOrganization (src/lib/auth.ts) so a brand-new shop isn't starting from an empty Make dropdown. */
export async function seedDefaultEquipmentMakes(organizationId: string) {
  await prisma.equipmentMake.createMany({
    data: DEFAULT_EQUIPMENT_MAKES.map((name) => ({ organizationId, name })),
    skipDuplicates: true,
  });
}
