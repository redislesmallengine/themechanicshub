import nodemailer from "nodemailer";
import { Resend } from "resend";
import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

export type EmailProvider = "resend" | "sendgrid" | "smtp";

export interface ResendCredentials {
  apiKey: string;
}
export interface SendGridCredentials {
  apiKey: string;
}
export interface SmtpCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
}

/**
 * Free-tier caps we cascade around. Deliberately conservative — the point
 * is to fall through to the next provider *before* actually hitting a real
 * rejection from the provider's own limit, not to squeeze out every last
 * send. window: "day" resets every 24h, "month" every 30 days.
 */
const QUOTAS: Record<EmailProvider, { window: "day" | "month"; limit: number }> = {
  resend: { window: "month", limit: 3000 },
  sendgrid: { window: "day", limit: 100 },
  smtp: { window: "day", limit: 150 }, // Hostinger mailbox — see build plan Stack table
};

async function isUnderQuota(organizationId: string, provider: EmailProvider): Promise<boolean> {
  const { window, limit } = QUOTAS[provider];
  const since = new Date();
  if (window === "day") since.setHours(since.getHours() - 24);
  else since.setDate(since.getDate() - 30);

  const count = await prisma.emailLog.count({
    where: { organizationId, provider, success: true, createdAt: { gte: since } },
  });
  return count < limit;
}

interface Candidate {
  provider: EmailProvider;
  credentials: ResendCredentials | SendGridCredentials | SmtpCredentials;
}

function platformDefault(): Candidate | null {
  if (!process.env.SMTP_HOST) return null;
  return {
    provider: "smtp",
    credentials: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      user: process.env.SMTP_USER ?? "",
      password: process.env.SMTP_PASSWORD ?? "",
    },
  };
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

async function sendViaResend(creds: ResendCredentials, from: string, to: string, subject: string, html: string, attachments?: EmailAttachment[]) {
  const resend = new Resend(creds.apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    attachments: attachments?.map((a) => ({ filename: a.filename, content: a.content })),
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

async function sendViaSendGrid(creds: SendGridCredentials, from: string, to: string, subject: string, html: string, attachments?: EmailAttachment[]) {
  sgMail.setApiKey(creds.apiKey);
  await sgMail.send({
    from,
    to,
    subject,
    html,
    // SendGrid wants base64-encoded content as a string, not a raw Buffer.
    attachments: attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64"), disposition: "attachment" })),
  });
}

async function sendViaSmtp(creds: SmtpCredentials, from: string, to: string, subject: string, html: string, attachments?: EmailAttachment[]) {
  const transport = nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.port === 465,
    auth: { user: creds.user, pass: creds.password },
  });
  await transport.sendMail({ from, to, subject, html, attachments });
}

async function sendVia(candidate: Candidate, from: string, to: string, subject: string, html: string, attachments?: EmailAttachment[]) {
  switch (candidate.provider) {
    case "resend":
      return sendViaResend(candidate.credentials as ResendCredentials, from, to, subject, html, attachments);
    case "sendgrid":
      return sendViaSendGrid(candidate.credentials as SendGridCredentials, from, to, subject, html, attachments);
    case "smtp":
      return sendViaSmtp(candidate.credentials as SmtpCredentials, from, to, subject, html, attachments);
  }
}

/** Powers the usage readout on Settings → Email — how close each configured provider is to its tracked cap. */
export async function getUsageSummary(organizationId: string) {
  const results: Record<EmailProvider, { used: number; limit: number; window: "day" | "month" }> = {} as never;
  for (const provider of Object.keys(QUOTAS) as EmailProvider[]) {
    const { window, limit } = QUOTAS[provider];
    const since = new Date();
    if (window === "day") since.setHours(since.getHours() - 24);
    else since.setDate(since.getDate() - 30);
    const used = await prisma.emailLog.count({ where: { organizationId, provider, success: true, createdAt: { gte: since } } });
    results[provider] = { used, limit, window };
  }
  return results;
}

/**
 * Sends one email.
 *
 * With an `organizationId`: cascades Resend → SendGrid → the shop's own
 * SMTP → the platform default, trying the next provider whenever the
 * current one is already at its tracked quota for the window (EmailLog),
 * or the send itself throws. That's what "use up Resend's free quota
 * first, then SendGrid's, then Hostinger" means in practice — exhaust the
 * cheapest/best option before falling back, without ever hard-stopping
 * while any configured provider still has room.
 *
 * Without one (e.g. a password reset before we've resolved which shop the
 * user belongs to): sends directly via the platform default, no cascade or
 * quota tracking — there's no organization to attribute usage logs to, and
 * the platform default is a single fixed provider anyway.
 */
export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  organizationId?: string | null;
  attachments?: EmailAttachment[];
  /** Powers the "Emails Sent" panel on that record's detail page — e.g. "estimate"/workOrderId, "invoice"/invoiceId. Omit for sends with no single natural record to attach to. */
  relatedType?: string;
  relatedId?: string;
}) {
  // Best-effort permanent copy of exactly what was attempted, regardless of
  // outcome — this must never be the reason an actual send fails, so any
  // error writing it is swallowed. See SentEmail's schema comment for why
  // this lives in sendMail() itself rather than each call site.
  async function logSent(success: boolean, provider: EmailProvider | null, errorMessage?: string) {
    try {
      await prisma.sentEmail.create({
        data: {
          organizationId: params.organizationId || null,
          to: params.to,
          subject: params.subject,
          html: params.html,
          provider,
          success,
          errorMessage: errorMessage ?? null,
          relatedType: params.relatedType ?? null,
          relatedId: params.relatedId ?? null,
        },
      });
    } catch {
      // logging the copy is best-effort — never let it mask the real outcome
    }
  }

  const fallback = platformDefault();

  if (!params.organizationId) {
    if (!fallback) {
      await logSent(false, null, "No email provider configured (SMTP_HOST is unset).");
      throw new Error("No email provider configured (SMTP_HOST is unset).");
    }
    const from = `Mechanic Shop Hub <${process.env.SMTP_FROM ?? process.env.SMTP_USER ?? ""}>`;
    try {
      await sendVia(fallback, from, params.to, params.subject, params.html, params.attachments);
      await logSent(true, fallback.provider);
      return;
    } catch (err) {
      await logSent(false, fallback.provider, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  const organizationId = params.organizationId;
  const settings = await prisma.emailSettings.findUnique({ where: { organizationId } });

  const candidates: Candidate[] = [];
  if (settings?.resendCredentials) candidates.push({ provider: "resend", credentials: JSON.parse(decrypt(settings.resendCredentials)) });
  if (settings?.sendgridCredentials) candidates.push({ provider: "sendgrid", credentials: JSON.parse(decrypt(settings.sendgridCredentials)) });
  if (settings?.smtpCredentials) candidates.push({ provider: "smtp", credentials: JSON.parse(decrypt(settings.smtpCredentials)) });
  if (fallback) candidates.push(fallback); // platform default always brings up the rear

  if (candidates.length === 0) {
    const message = "No email provider configured (not even the platform default — check SMTP_HOST).";
    await logSent(false, null, message);
    throw new Error(message);
  }

  const fromName = settings?.fromName ?? "Mechanic Shop Hub";
  const fromEmail = settings?.fromEmail ?? process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "";
  const from = `${fromName} <${fromEmail}>`;

  let lastError: unknown;
  let lastProvider: EmailProvider | null = null;
  for (const candidate of candidates) {
    if (!(await isUnderQuota(organizationId, candidate.provider))) continue; // next in the cascade

    try {
      await sendVia(candidate, from, params.to, params.subject, params.html, params.attachments);
      await prisma.emailLog.create({ data: { organizationId, provider: candidate.provider, success: true } });
      await logSent(true, candidate.provider);
      return;
    } catch (err) {
      lastError = err;
      lastProvider = candidate.provider;
      await prisma.emailLog.create({ data: { organizationId, provider: candidate.provider, success: false } });
      // fall through to the next candidate
    }
  }

  const message = `All configured email providers are over quota or failing. Last error: ${
    lastError instanceof Error ? lastError.message : String(lastError)
  }`;
  await logSent(false, lastProvider, message);
  throw new Error(message);
}
