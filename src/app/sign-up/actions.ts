"use server";

import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedDefaultRolesForOrg } from "@/lib/rbac";
import { seedDefaultEquipmentTypes } from "@/lib/equipment-types";
import { seedDefaultEquipmentMakes } from "@/lib/equipment-makes";
import { seedDefaultEngineTypes } from "@/lib/engine-types";
import { seedDefaultPartCategories } from "@/lib/part-categories";
import { notifySiteAdminsOfNewShop } from "@/lib/shop-approval";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Registers a new shop and its owner. Nobody is signed in afterwards: the shop starts as
 * "pending" and the site administrator has to approve it first (Shop Approvals). Doing this
 * on the server, rather than from the browser, is what guarantees that -- the browser never
 * receives a session, so there is nothing to use before approval.
 */
export async function registerShop(input: { shopName: string; name: string; email: string; password: string }) {
  const shopName = input.shopName.trim();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!shopName) return { error: "Enter your shop's name." };
  if (!name) return { error: "Enter your name." };
  if (!email) return { error: "Enter your email address." };
  if (password.length < 8) return { error: "Your password needs to be at least 8 characters." };

  let userId: string;
  try {
    const created = await auth.api.signUpEmail({ body: { email, password, name }, headers: await headers() });
    userId = created.user.id;
  } catch (e) {
    return { error: e instanceof APIError ? e.message || "Couldn't create that account." : "Couldn't create that account." };
  }

  try {
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: shopName, slug: `${slugify(shopName) || "shop"}-${Math.random().toString(36).slice(2, 6)}` },
      });
      await tx.member.create({ data: { organizationId: org.id, userId, role: "owner" } });
      return org;
    });
    await seedDefaultRolesForOrg(organization.id);
    await seedDefaultEquipmentTypes(organization.id);
    await seedDefaultEquipmentMakes(organization.id);
    await seedDefaultEngineTypes(organization.id);
    await seedDefaultPartCategories(organization.id);
  } catch {
    // Don't leave an account behind with no shop -- that would stop them trying again with the same email.
    await prisma.user.delete({ where: { id: userId } }).catch(() => null);
    return { error: "We couldn't set up your shop. Please try again." };
  }

  // The sign-up above started a session; throw it away so the new owner is not signed in.
  await prisma.session.deleteMany({ where: { userId } });

  await notifySiteAdminsOfNewShop({ name: shopName, ownerName: name, ownerEmail: email });

  return { success: true as const };
}
