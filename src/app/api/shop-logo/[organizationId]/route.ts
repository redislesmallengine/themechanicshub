import { prisma } from "@/lib/prisma";
import { getImage } from "@/lib/storage";

// Public by design — a shop's logo is meant to be visible (header, future
// customer-facing invoice/estimate pages), and <img> tags can't send auth
// headers anyway. Never exposes S3 credentials or a direct bucket URL:
// this streams the object through our own server using src/lib/storage.ts.
export async function GET(_req: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;

  const profile = await prisma.shopProfile.findUnique({ where: { organizationId }, select: { logoKey: true } });
  if (!profile?.logoKey) return new Response("Not found", { status: 404 });

  const logo = await getImage(profile.logoKey);
  if (!logo) return new Response("Not found", { status: 404 });

  return new Response(logo.body, {
    headers: {
      "Content-Type": logo.contentType,
      "Cache-Control": "public, max-age=300", // short cache — logo can change from Settings at any time
    },
  });
}
