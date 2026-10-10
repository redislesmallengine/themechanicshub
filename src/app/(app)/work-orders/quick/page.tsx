import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuickJobForm } from "@/components/quick-job-form";

export default async function QuickJobPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const { customerId } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");
  const organizationId = session.session.activeOrganizationId;

  const [customers, equipmentTypes, makes, { members }, parts, shopProfile] = await Promise.all([
    prisma.customer.findMany({ where: { organizationId }, orderBy: { name: "asc" }, include: { equipment: { include: { equipmentType: true } } } }),
    prisma.equipmentType.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    prisma.equipmentMake.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    auth.api.listMembers({ headers: reqHeaders }),
    prisma.part.findMany({ where: { organizationId, quantityOnHand: { gt: 0 } }, orderBy: { name: "asc" } }),
    prisma.shopProfile.findUnique({ where: { organizationId } }),
  ]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Quick Job
        </h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          For work that starts and finishes at the counter. Needs a written estimate, or just dropping a machine off?{" "}
          <Link href="/work-orders/new" className="font-semibold text-brand-600">
            Use New Work Order
          </Link>{" "}
          instead.
        </p>
      </div>
      <QuickJobForm
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          equipment: c.equipment.map((eq) => ({
            id: eq.id,
            label: [eq.make, eq.model].filter(Boolean).join(" / ") || eq.equipmentType?.name || (eq.serialNumber ? `S/N ${eq.serialNumber}` : "Unnamed equipment"),
          })),
        }))}
        initialCustomerId={customers.find((c) => c.id === customerId)?.id ?? ""}
        equipmentTypes={equipmentTypes.map((t) => ({ id: t.id, name: t.name }))}
        makes={makes.map((m) => m.name)}
        members={members.filter((m) => m.user).map((m) => ({ userId: m.userId, name: m.user!.name }))}
        currentUserId={session.user.id}
        parts={parts.map((p) => ({ id: p.id, name: p.name, quantityOnHand: p.quantityOnHand, sellPrice: p.sellPrice ? Number(p.sellPrice) : 0 }))}
        shop={{
          labourRate: shopProfile?.labourRate ? Number(shopProfile.labourRate) : null,
          diagnosticFee: shopProfile?.diagnosticFee ? Number(shopProfile.diagnosticFee) : null,
          deliveryFeeDefault: shopProfile?.deliveryFee?.toString() ?? "",
          taxRate: shopProfile?.taxRate ? Number(shopProfile.taxRate) : 0,
          taxLabel: shopProfile?.taxLabel ?? "Tax",
        }}
      />
    </div>
  );
}
