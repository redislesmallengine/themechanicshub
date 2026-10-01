"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Shop-wide, not per-user -- once anyone dismisses the Getting Started checklist (or every step is done), it stays hidden for the whole shop, not just the browser that dismissed it. */
export async function dismissGettingStarted() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;
  if (!organizationId) return { error: "Not signed in to a shop." };

  // upsert, not update -- a brand-new org (the exact audience for this
  // checklist) may not have a ShopProfile row yet at all.
  await prisma.shopProfile.upsert({
    where: { organizationId },
    update: { gettingStartedDismissed: true },
    create: { organizationId, gettingStartedDismissed: true },
  });

  revalidatePath("/dashboard");
  return { success: true };
}
