import { prisma } from "@/lib/prisma";

/** Starting point for a new shop's Part Categories list (Settings -> Part Categories) — editable/addable/deletable per-org from there afterward. */
export const DEFAULT_PART_CATEGORIES = [
  "Spark Plugs",
  "Carb Kits",
  "Belts",
  "Blades",
  "2-Stroke Oil",
  "Air Filters",
  "Fuel Lines",
  "Bar & Chain",
  "Batteries",
  "Other",
] as const;

/** Called once from organizationHooks.afterCreateOrganization (src/lib/auth.ts) so a brand-new shop isn't starting from an empty dropdown. */
export async function seedDefaultPartCategories(organizationId: string) {
  await prisma.partCategory.createMany({
    data: DEFAULT_PART_CATEGORIES.map((name) => ({ organizationId, name })),
    skipDuplicates: true,
  });
}
