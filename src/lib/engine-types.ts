import { prisma } from "@/lib/prisma";

/** Starting point for a new shop's Engine Types list (Settings -> Engine Types) — editable/addable/deletable per-org from there afterward. */
export const DEFAULT_ENGINE_TYPES = ["2-stroke", "4-stroke", "Electric", "Battery"] as const;

/** Called once from organizationHooks.afterCreateOrganization (src/lib/auth.ts) so a brand-new shop isn't starting from an empty Engine Type dropdown. */
export async function seedDefaultEngineTypes(organizationId: string) {
  await prisma.engineType.createMany({
    data: DEFAULT_ENGINE_TYPES.map((name) => ({ organizationId, name })),
    skipDuplicates: true,
  });
}
