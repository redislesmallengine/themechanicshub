import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// AES-256-GCM at the application layer for anything stored in the DB that
// shouldn't be readable as plaintext by anyone with DB access — currently
// just EmailSettings.credentials (API keys, SMTP passwords). One key, from
// CREDENTIALS_ENCRYPTION_KEY, derived into a proper 256-bit key via scrypt
// so the env var itself doesn't need to be exactly 32 bytes.
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set — cannot encrypt/decrypt stored credentials.");
  }
  return scryptSync(secret, "mechanicshophub-credentials", 32);
}

/** Encrypts a plaintext string, returning `iv:authTag:ciphertext` (all hex). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/** Reverses encrypt(). Throws if the value was tampered with or the key is wrong. */
export function decrypt(payload: string): string {
  const [ivHex, authTagHex, ciphertextHex] = payload.split(":");
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf8");
}

// Unrelated to the AES-GCM helpers above beyond both living in "crypto" —
// used by Staff → Add User (src/app/(app)/staff/actions.ts) to create a
// login for a staff member on the spot instead of emailing an invite.
// Shown once on screen to the admin; never stored in plaintext (Better
// Auth hashes it into Account.password immediately) and never emailed.
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
export function generateTemporaryPassword(length = 14): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  return out;
}
