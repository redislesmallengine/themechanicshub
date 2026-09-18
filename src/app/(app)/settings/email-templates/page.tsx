import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EMAIL_TEMPLATE_KEYS, EMAIL_TEMPLATE_META, loadEmailTemplate } from "@/lib/email-templates";
import { EmailTemplateEditor, type EmailTemplateData } from "@/components/email-template-editor";

export default async function EmailTemplatesPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/dashboard");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) redirect("/dashboard");

  const organizationId = session.session.activeOrganizationId;

  const templates: EmailTemplateData[] = await Promise.all(
    EMAIL_TEMPLATE_KEYS.map(async (key) => {
      const meta = EMAIL_TEMPLATE_META[key];
      const current = await loadEmailTemplate(organizationId, key);
      return {
        key,
        label: meta.label,
        description: meta.description,
        tokens: meta.tokens,
        requiredTokens: meta.requiredTokens,
        subject: current.subject,
        html: current.html,
        isCustom: current.isCustom,
      };
    })
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Email Templates
        </h1>
        <p className="text-xs mt-0.5 max-w-2xl" style={{ color: "var(--text-muted)" }}>
          Customize the wording of every email your shop sends. Each one starts with a working default — change what you want, preview it with sample
          data, and save. Anything left alone keeps sending as-is.
        </p>
      </div>

      <EmailTemplateEditor templates={templates} />
    </div>
  );
}
