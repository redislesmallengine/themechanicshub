import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ServiceManager } from "@/components/service-manager";

export default async function ServicesPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/dashboard");

  const allowed = await auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { shopSettings: ["update"] } } });
  if (!allowed.success) redirect("/dashboard");

  const services = await prisma.service.findMany({ where: { organizationId: session.session.activeOrganizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Services
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Jobs you do again and again, each with a set price, for example &ldquo;Snowblower Full Service $180&rdquo;. Pick one when billing and it goes on the invoice as one line, with what it included in the notes.
        </p>
      </div>
      <div className="max-w-3xl">
        <ServiceManager items={services.map((s) => ({ id: s.id, name: s.name, price: s.price.toString(), taxable: s.taxable, description: s.description, active: s.active }))} />
      </div>
    </div>
  );
}
