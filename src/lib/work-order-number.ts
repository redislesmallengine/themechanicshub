// Work order numbers: a short, readable reference for a job ("WO-1042"), counted per shop and never reused. The internal id
// stays as it is; this is the number people read out and search for.

import type { Prisma } from "@/generated/prisma/client";

/** How a number is written. */
export function formatWorkOrderNumber(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : `WO-${n}`;
}

/**
 * Reads a typed search as a work order number: "1042", "WO-1042", "wo1042" and "WO 1042" all mean 1042. Anything else
 * (a name, a phone number with dashes, a part number) is not a work order number, so the caller searches the usual fields.
 */
export function parseWorkOrderSearch(term: string): number | null {
  const m = /^(?:wo[\s-]*)?(\d{1,9})$/i.exec(term.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 && n <= 2_147_483_647 ? n : null;
}

/** Takes the next number for a shop, inside the transaction that creates the job, so two jobs never get the same one. */
export async function claimWorkOrderNumber(tx: Prisma.TransactionClient, organizationId: string): Promise<number> {
  const profile = await tx.shopProfile.upsert({
    where: { organizationId },
    create: { organizationId, nextWorkOrderNumber: 1002 },
    update: { nextWorkOrderNumber: { increment: 1 } },
    select: { nextWorkOrderNumber: true },
  });
  return profile.nextWorkOrderNumber - 1;
}
