"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { sendMail } from "@/lib/email";

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

  const fromName = String(formData.get("fromName") ?? "");
  const fromEmail = String(formData.get("fromEmail") ?? "");
  if (!fromName || !fromEmail) return { error: "From Name and From Email are both required." };

  const existing = await prisma.emailSettings.findUnique({ where: { organizationId } });

  // Each provider section is independent and optional. An empty field means
  // "leave the currently-saved value alone" (so re-saving the form doesn't
  // wipe a credential you're not touching); an explicit "Disconnect" clears
  // one section without affecting the others — see clearEmailProvider below.
  const resendApiKey = String(formData.get("resendApiKey") ?? "").trim();
  const resendCredentials = resendApiKey
    ? encrypt(JSON.stringify({ apiKey: resendApiKey }))
    : (existing?.resendCredentials ?? null);

  const sendgridApiKey = String(formData.get("sendgridApiKey") ?? "").trim();
  const sendgridCredentials = sendgridApiKey
    ? encrypt(JSON.stringify({ apiKey: sendgridApiKey }))
    : (existing?.sendgridCredentials ?? null);

  const smtpHost = String(formData.get("smtpHost") ?? "").trim();
  const smtpUser = String(formData.get("smtpUser") ?? "").trim();
  const smtpPassword = String(formData.get("smtpPassword") ?? "").trim();
  const smtpPort = Number(formData.get("smtpPort") ?? 465);
  let smtpCredentials = existing?.smtpCredentials ?? null;
  if (smtpHost || smtpUser || smtpPassword) {
    if (!smtpHost || !smtpUser || !smtpPassword) {
      return { error: "SMTP host, username, and password are all required to save that section." };
    }
    smtpCredentials = encrypt(JSON.stringify({ host: smtpHost, port: smtpPort, user: smtpUser, password: smtpPassword }));
  }

  await prisma.emailSettings.upsert({
    where: { organizationId },
    create: { organizationId, fromName, fromEmail, resendCredentials, sendgridCredentials, smtpCredentials },
    update: { fromName, fromEmail, resendCredentials, sendgridCredentials, smtpCredentials },
  });

  revalidatePath("/settings/email");
  return { success: true };
}

export async function clearEmailProvider(provider: "resend" | "sendgrid" | "smtp") {
  const { organizationId } = await requireCanManageSettings();
  const field = provider === "resend" ? "resendCredentials" : provider === "sendgrid" ? "sendgridCredentials" : "smtpCredentials";
  await prisma.emailSettings.update({ where: { organizationId }, data: { [field]: null } });
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
