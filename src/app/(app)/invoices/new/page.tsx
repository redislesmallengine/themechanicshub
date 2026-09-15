import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewInvoiceForm } from "@/components/new-invoice-form";

export default async function NewInvoicePage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { invoice: ["create"] } },
  });
  if (!allowed.success) redirect("/invoices");

  const customers = await prisma.customer.findMany({
    where: { organizationId: session.session.activeOrganizationId },
    orderBy: { name: "asc" },
    include: { equipment: { include: { equipmentType: true } } },
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          New Invoice
        </h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          For a parts sale or a repair billed on the spot — no work order needed.
        </p>
      </div>
      <div className="max-w-3xl">
        <NewInvoiceForm
          customers={customers.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            equipment: c.equipment.map((eq) => ({
              id: eq.id,
              label: [eq.make, eq.model].filter(Boolean).join(" ") || eq.equipmentType?.name || (eq.serialNumber ? `S/N ${eq.serialNumber}` : "Unnamed equipment"),
            })),
          }))}
        />
      </div>
    </div>
  );
}
