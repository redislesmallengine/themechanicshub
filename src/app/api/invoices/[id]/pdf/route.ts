import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdfFromRecord } from "@/lib/invoice-pdf";

// Authenticated download — /api/invoice/[token]/pdf is the public equivalent for the customer's own link.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) return new Response("Not signed in", { status: 401 });

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } }, customer: true, organization: { include: { shopProfile: true } } },
  });
  if (!invoice || invoice.organizationId !== session.session.activeOrganizationId) return new Response("Not found", { status: 404 });

  const pdf = await renderInvoicePdfFromRecord(invoice);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
