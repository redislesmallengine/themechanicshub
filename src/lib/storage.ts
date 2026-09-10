import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Garage (self-hosted, S3-compatible — see build plan Stack table) is the
// only thing this talks to today, but nothing here is Garage-specific: same
// S3 API as MinIO/R2/AWS, so swapping providers later is an env var change,
// not a rewrite.
function getClient(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 storage isn't configured (S3_ENDPOINT/S3_REGION/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY).");
  }
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // Garage doesn't do virtual-hosted-style (bucket.host/key) — needs bucket in the path
  });
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET isn't configured.");
  return bucket;
}

function extOf(file: File): string {
  return (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
}

async function putImage(key: string, file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: bytes,
      ContentType: file.type || "application/octet-stream",
    })
  );
  return key;
}

/** Uploads a shop logo, returning the object key to store on ShopProfile.logoKey (never a public URL — see /api/shop-logo). */
export async function uploadLogo(organizationId: string, file: File): Promise<string> {
  return putImage(`logos/${organizationId}/${Date.now()}.${extOf(file)}`, file);
}

/** Uploads an equipment photo, returning the object key to store on Equipment.photoKey (never a public URL — see /api/equipment-photo). */
export async function uploadEquipmentPhoto(organizationId: string, equipmentId: string, file: File): Promise<string> {
  return putImage(`equipment/${organizationId}/${equipmentId}/${Date.now()}.${extOf(file)}`, file);
}

/** Streams a stored image back out — used by /api/shop-logo and /api/equipment-photo, never exposed as a direct S3 URL. */
export async function getImage(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  try {
    const result = await getClient().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    if (!result.Body) return null;
    return {
      body: result.Body.transformToWebStream(),
      contentType: result.ContentType || "application/octet-stream",
    };
  } catch {
    return null; // missing object, bad key, etc. — treat as "not found" rather than a hard error
  }
}

/** Best-effort cleanup when an image is replaced or removed — never blocks the save if it fails. */
export async function deleteImage(key: string): Promise<void> {
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
  } catch {
    // orphaned object in the bucket is a non-issue, not worth failing the request over
  }
}
