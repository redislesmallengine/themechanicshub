import { prisma } from "@/lib/prisma";
import { renderInvoicePdfFromRecord } from "@/lib/invoice-pdf";

// Public — the download link on the customer-facing /invoice/[token] page and in the "Send Invoice" email.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { viewToken: token },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      customer: true,
      equipment: { include: { equipmentType: true } },
      organization: { include: { shopProfile: true } },
    },
  });
  if (!invoice) return new Response("Not found", { status: 404 });

  const pdf = await renderInvoicePdfFromRecord(invoice);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
