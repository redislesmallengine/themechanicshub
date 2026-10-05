import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Public short alias for an invoice's view link (used in WhatsApp messages).
// Redirects to the normal /invoice/[token] page rather than duplicating it,
// so draft hiding, the Sent -> Viewed flip, and the staff draft preview all
// stay in one place. An unknown code is sent to a token that can't exist,
// which that page already renders as "Link not valid".
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { shortCode: code }, select: { viewToken: true } });
  redirect(`/invoice/${invoice?.viewToken ?? "invalid"}`);
}
