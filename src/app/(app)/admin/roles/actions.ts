"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSiteAdmin, slugifyRoleKey, sanitizePermissions, syncRoleToAllOrgs, removeRoleFromAllOrgs, countMembersWithRole } from "@/lib/rbac";

export async function createRole(formData: FormData) {
  await requireSiteAdmin();

  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!label) return { error: "Give the role a name." };

  const key = slugifyRoleKey(label);
  if (!key || key === "owner") return { error: "That name isn't usable as a role — try something more specific." };

  const existing = await prisma.platformRole.findUnique({ where: { key } });
  if (existing) return { error: `A role named "${label}" already exists.` };

  const permissions = sanitizePermissions(readPermissionsFromForm(formData));

  await prisma.platformRole.create({
    data: { key, label, description: description || null, permissions },
  });
  await syncRoleToAllOrgs(key, permissions);

  revalidatePath("/admin/roles");
  return { success: true };
}

export async function updateRole(key: string, formData: FormData) {
  await requireSiteAdmin();
  if (key === "owner") return { error: "Owner is built in and can't be edited." };

  const existing = await prisma.platformRole.findUnique({ where: { key } });
  if (!existing) return { error: "That role no longer exists." };

  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!label) return { error: "Give the role a name." };

  const permissions = sanitizePermissions(readPermissionsFromForm(formData), existing.permissions as Record<string, string[]>);

  await prisma.platformRole.update({
    where: { key },
    data: { label, description: description || null, permissions },
  });
  await syncRoleToAllOrgs(key, permissions);

  revalidatePath("/admin/roles");
  return { success: true };
}

export async function deleteRole(key: string) {
  await requireSiteAdmin();
  if (key === "owner") return { error: "Owner is built in and can't be deleted." };

  const inUse = await countMembersWithRole(key);
  if (inUse > 0) {
    return { error: `${inUse} staff account${inUse === 1 ? "" : "s"} currently ${inUse === 1 ? "has" : "have"} this role — reassign them first.` };
  }

  await prisma.platformRole.delete({ where: { key } }).catch(() => null);
  await removeRoleFromAllOrgs(key);

  revalidatePath("/admin/roles");
  return { success: true };
}

function readPermissionsFromForm(formData: FormData): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [name] of formData.entries()) {
    const match = /^perm__(.+)__(.+)$/.exec(name);
    if (!match) continue;
    const [, resource, action] = match;
    (out[resource] ??= []).push(action);
  }
  return out;
}
