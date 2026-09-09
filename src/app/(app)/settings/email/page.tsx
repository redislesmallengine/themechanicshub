import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUsageSummary } from "@/lib/email";
import { EmailSettingsForm } from "@/components/email-settings-form";

export default async function EmailSettingsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/dashboard");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) redirect("/dashboard");

  const organizationId = session.session.activeOrganizationId;
  const [settings, usage] = await Promise.all([
    prisma.emailSettings.findUnique({ where: { organizationId } }),
    getUsageSummary(organizationId),
  ]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Email Settings
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Connect one or more providers for staff invites and password resets — sending cascades through them in order.
        </p>
      </div>

      <div className="max-w-3xl">
        <EmailSettingsForm
          initialFromName={settings?.fromName ?? "Mechanic Shop Hub"}
          initialFromEmail={settings?.fromEmail ?? ""}
          connected={{
            resend: !!settings?.resendCredentials,
            sendgrid: !!settings?.sendgridCredentials,
            smtp: !!settings?.smtpCredentials,
          }}
          usage={usage}
        />
      </div>
    </div>
  );
}
