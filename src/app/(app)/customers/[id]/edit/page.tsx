import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomerForm } from "@/components/customer-form";
import { updateCustomer } from "@/app/(app)/customers/actions";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer || customer.organizationId !== session.session.activeOrganizationId) notFound();

  const boundUpdate = updateCustomer.bind(null, id);

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-xs mb-1">
          <a href={`/customers/${customer.id}`} className="font-semibold text-brand-600">
            {customer.name}
          </a>
        </p>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Edit Customer
        </h1>
      </div>
      <div className="max-w-2xl">
        <CustomerForm
          mode="edit"
          initialName={customer.name}
          initialPhone={customer.phone ?? ""}
          initialEmail={customer.email ?? ""}
          initialAddress={customer.address ?? ""}
          initialNotes={customer.notes ?? ""}
          cancelHref={`/customers/${customer.id}`}
          onSubmit={boundUpdate}
        />
      </div>
    </div>
  );
}
