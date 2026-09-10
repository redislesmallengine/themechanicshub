import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ShopProfileForm } from "@/components/shop-profile-form";

export default async function ShopProfilePage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/dashboard");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) redirect("/dashboard");

  const organizationId = session.session.activeOrganizationId;
  const [organization, profile] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.shopProfile.findUnique({ where: { organizationId } }),
  ]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Shop Profile
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Branding, contact info, and billing defaults — invoicing pulls these in automatically.
        </p>
      </div>

      <div className="max-w-3xl">
        <ShopProfileForm
          organizationId={organizationId}
          initialName={organization?.name ?? ""}
          initialAddress={profile?.address ?? ""}
          initialPhone={profile?.phone ?? ""}
          initialLaborRate={profile?.laborRate?.toString() ?? ""}
          initialDiagnosticFee={profile?.diagnosticFee?.toString() ?? ""}
          initialTaxRate={profile?.taxRate?.toString() ?? ""}
          initialTaxLabel={profile?.taxLabel ?? ""}
          initialProvince={profile?.province ?? ""}
          hasLogo={!!profile?.logoKey}
        />
      </div>
    </div>
  );
}
