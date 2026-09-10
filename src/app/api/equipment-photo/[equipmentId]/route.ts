import { prisma } from "@/lib/prisma";
import { getImage } from "@/lib/storage";

// Public by design, same reasoning as /api/shop-logo — <img> tags can't
// send auth headers, and this never exposes S3 credentials or a direct
// bucket URL, only streams the object through our own server.
export async function GET(_req: Request, { params }: { params: Promise<{ equipmentId: string }> }) {
  const { equipmentId } = await params;

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { photoKey: true } });
  if (!equipment?.photoKey) return new Response("Not found", { status: 404 });

  const photo = await getImage(equipment.photoKey);
  if (!photo) return new Response("Not found", { status: 404 });

  return new Response(photo.body, {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
