import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailSettingsForm } from "@/components/email-settings-form";
import type { EmailProvider } from "@/lib/email";

export default async function EmailSettingsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/dashboard");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) redirect("/dashboard");

  const settings = await prisma.emailSettings.findUnique({
    where: { organizationId: session.session.activeOrganizationId },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Email Settings
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Choose which provider sends staff invites and password resets, and what customers see as the sender.
        </p>
      </div>

      <div className="max-w-3xl">
        <EmailSettingsForm
          initialProvider={(settings?.provider as EmailProvider) ?? "smtp"}
          initialFromName={settings?.fromName ?? "Mechanic Shop Hub"}
          initialFromEmail={settings?.fromEmail ?? ""}
          hasCredentials={!!settings}
        />
      </div>
    </div>
  );
}
