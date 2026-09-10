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

/** Uploads a shop logo, returning the object key to store on ShopProfile.logoKey (never a public URL — see /api/shop-logo). */
export async function uploadLogo(organizationId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const key = `logos/${organizationId}/${Date.now()}.${ext}`;
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

/** Streams a stored logo back out — used by /api/shop-logo/[organizationId], never exposed as a direct S3 URL. */
export async function getLogo(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  try {
    const result = await getClient().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    if (!result.Body) return null;
    return {
      body: result.Body.transformToWebStream(),
      contentType: result.ContentType || "application/octet-stream",
    };
  } catch {
    return null; // missing object, bad key, etc. — treat as "no logo" rather than a hard error
  }
}

/** Best-effort cleanup when a logo is replaced or removed — never blocks the save if it fails. */
export async function deleteLogo(key: string): Promise<void> {
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
  } catch {
    // orphaned object in the bucket is a non-issue, not worth failing the request over
  }
}
