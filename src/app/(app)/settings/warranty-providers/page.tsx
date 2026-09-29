import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WarrantyProviderManager } from "@/components/warranty-provider-manager";
import { addWarrantyProvider, updateWarrantyProvider, deleteWarrantyProvider } from "./actions";

export default async function WarrantyProvidersPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/dashboard");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) redirect("/dashboard");

  const organizationId = session.session.activeOrganizationId;
  const providers = await prisma.warrantyProvider.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { invoices: true } } },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Warranty Providers
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Manufacturers and warranty companies you bill for covered repairs — pick one when an invoice is a warranty claim instead of a customer bill.
        </p>
      </div>

      <div className="max-w-4xl">
        <WarrantyProviderManager
          items={providers.map((p) => ({ id: p.id, name: p.name, billingEmail: p.billingEmail, billingAddress: p.billingAddress, count: p._count.invoices }))}
          onAdd={addWarrantyProvider}
          onUpdate={updateWarrantyProvider}
          onDelete={deleteWarrantyProvider}
        />
      </div>
    </div>
  );
}
