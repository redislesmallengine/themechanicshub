import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// No 0/O/1/I/l so a code read aloud or retyped can't be misread.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const CODE_LENGTH = 10; // ~58 bits -- far short of the 192-bit view token, but not guessable by brute force over HTTP

function generateShortCode(): string {
  // Rejection sampling: only bytes below the largest multiple of the
  // alphabet size are used, so every character is equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  let code = "";
  while (code.length < CODE_LENGTH) {
    for (const byte of randomBytes(CODE_LENGTH * 2)) {
      if (byte < limit && code.length < CODE_LENGTH) code += ALPHABET[byte % ALPHABET.length];
    }
  }
  return code;
}

/**
 * The invoice's short alias, creating it on first use. Lazy rather than set
 * at creation so every existing invoice gets one without a backfill and the
 * three invoice-creation paths stay untouched. updateMany with
 * `shortCode: null` makes two simultaneous first calls safe (only one
 * wins), and a unique-constraint collision just retries with a new code.
 * Returns null only if something is genuinely wrong, so callers can fall
 * back to the long link.
 */
export async function ensureInvoiceShortCode(invoiceId: string): Promise<string | null> {
  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { shortCode: true } });
  if (!existing) return null;
  if (existing.shortCode) return existing.shortCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.invoice.updateMany({ where: { id: invoiceId, shortCode: null }, data: { shortCode: generateShortCode() } });
      break;
    } catch {
      // collision on the unique index -- loop and try a different code
    }
  }

  const after = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { shortCode: true } });
  return after?.shortCode ?? null;
}
