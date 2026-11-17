import { prisma } from "@/lib/prisma";

// Configuration -> Email is not for shop owners in general: invoices, estimates, password resets and staff invites all send
// through the platform's own email without it. A person can open that page only when the platform operator has switched
// "canConfigureEmail" on for them (by hand in the database, like User.isSiteAdmin) -- site administrators always can.
export async function canConfigureEmail(user: { id: string; isSiteAdmin?: boolean | null }): Promise<boolean> {
  if (user.isSiteAdmin) return true;
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { canConfigureEmail: true } });
  return row?.canConfigureEmail ?? false;
}
