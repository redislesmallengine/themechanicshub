"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { sendMail } from "@/lib/email";
import type { EmailProvider } from "@/lib/email";

async function requireCanManageSettings() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) throw new Error("You don't have permission to change shop settings.");

  return { organizationId: session.session.activeOrganizationId, userEmail: session.user.email };
}

export async function saveEmailSettings(formData: FormData) {
  const { organizationId } = await requireCanManageSettings();

  const provider = formData.get("provider") as EmailProvider;
  const fromName = String(formData.get("fromName") ?? "");
  const fromEmail = String(formData.get("fromEmail") ?? "");

  let credentials: Record<string, string | number>;
  if (provider === "resend" || provider === "sendgrid") {
    const apiKey = String(formData.get("apiKey") ?? "");
    if (!apiKey) return { error: "API key is required." };
    credentials = { apiKey };
  } else {
    const host = String(formData.get("host") ?? "");
    const port = Number(formData.get("port") ?? 465);
    const user = String(formData.get("user") ?? "");
    const password = String(formData.get("password") ?? "");
    if (!host || !user || !password) return { error: "Host, username, and password are all required." };
    credentials = { host, port, user, password };
  }

  await prisma.emailSettings.upsert({
    where: { organizationId },
    create: { organizationId, provider, fromName, fromEmail, credentials: encrypt(JSON.stringify(credentials)) },
    update: { provider, fromName, fromEmail, credentials: encrypt(JSON.stringify(credentials)) },
  });

  revalidatePath("/settings/email");
  return { success: true };
}

export async function sendTestEmail() {
  const { organizationId, userEmail } = await requireCanManageSettings();

  try {
    await sendMail({
      to: userEmail,
      subject: "Mechanic Shop Hub — test email",
      html: `<p>This is a test email from your Mechanic Shop Hub email settings. If you got this, it's working.</p>`,
      organizationId,
    });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Test email failed to send." };
  }
}
