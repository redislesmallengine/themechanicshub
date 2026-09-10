"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireCanManageCustomers(action: "create" | "update" = "create") {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { customer: [action] } },
  });
  if (!allowed.success) throw new Error(`You don't have permission to ${action === "create" ? "add" : "edit"} customers.`);

  return { organizationId: session.session.activeOrganizationId };
}

export async function createCustomer(formData: FormData) {
  const { organizationId } = await requireCanManageCustomers("create");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "Customer name is required." };
  if (!phone && !email) return { error: "At least a phone number or email is required — that's what front desk will search by." };

  const customer = await prisma.customer.create({
    data: { organizationId, name, phone: phone || null, email: email || null, notes: notes || null },
  });

  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(customerId: string, formData: FormData) {
  const { organizationId } = await requireCanManageCustomers("update");

  const existing = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!existing || existing.organizationId !== organizationId) return { error: "That customer doesn't exist." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "Customer name is required." };
  if (!phone && !email) return { error: "At least a phone number or email is required — that's what front desk will search by." };

  await prisma.customer.update({
    where: { id: customerId },
    data: { name, phone: phone || null, email: email || null, notes: notes || null },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}`);
}
