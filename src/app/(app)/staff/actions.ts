"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTemporaryPassword } from "@/lib/crypto";
import { asRole } from "@/lib/permissions";

async function requireCanManageMembers() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { member: ["create"] } },
  });
  if (!allowed.success) throw new Error("You don't have permission to add staff.");

  return { organizationId: session.session.activeOrganizationId, reqHeaders };
}

/**
 * Creates a real login for a staff member immediately — no email round
 * trip. A strong password is generated here and returned once so the
 * caller (the form) can show it on screen for the admin to relay; it's
 * never stored in plaintext (Better Auth hashes it right away) and never
 * emailed anywhere.
 *
 * Calls auth.api.signUpEmail directly rather than going through the
 * /sign-up/email HTTP route — this is a server action, not a route
 * handler, so nothing here forwards a Set-Cookie back to the admin's own
 * browser; the admin's session is untouched.
 */
export async function addUserDirectly(formData: FormData) {
  const { organizationId, reqHeaders } = await requireCanManageMembers();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "").trim();
  if (!name || !email || !role) return { error: "Name, email, and role are all required." };

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId: existingUser.id } },
    });
    if (alreadyMember) return { error: `${email} is already on this shop's staff.` };
    // A person with an account elsewhere in the system but not this shop —
    // add them as a member directly rather than erroring; no new password
    // needed since they can already sign in.
    const addResult = await auth.api.addMember({
      headers: reqHeaders,
      body: { organizationId, userId: existingUser.id, role: asRole(role) },
    });
    if (!addResult) return { error: "Couldn't add that person to the shop." };
    revalidatePath("/staff");
    return { success: true, email, existingAccount: true };
  }

  const password = generateTemporaryPassword();
  let signUpResult;
  try {
    signUpResult = await auth.api.signUpEmail({ body: { name, email, password } });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't create that account." };
  }
  if (!signUpResult?.user) return { error: "Couldn't create that account." };

  const addResult = await auth.api.addMember({
    headers: reqHeaders,
    body: { organizationId, userId: signUpResult.user.id, role: asRole(role) },
  });
  if (!addResult) return { error: "Account was created, but couldn't be added to this shop — check Staff and try adding them again." };

  revalidatePath("/staff");
  return { success: true, email, password };
}
