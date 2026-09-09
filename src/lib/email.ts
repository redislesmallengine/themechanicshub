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

interface ResolvedEmailConfig {
  provider: EmailProvider;
  fromName: string;
  fromEmail: string;
  credentials: ResendCredentials | SendGridCredentials | SmtpCredentials;
}

/**
 * Settings → Email lets an Owner/Manager configure one of three providers
 * per shop. Falls back to the platform's own Hostinger SMTP env vars
 * (set in Coolify) when a shop hasn't configured anything yet — so the app
 * keeps working out of the box, and a shop only needs Settings → Email if
 * they want to switch providers or use their own account.
 */
async function resolveConfig(organizationId?: string | null): Promise<ResolvedEmailConfig> {
  if (organizationId) {
    const settings = await prisma.emailSettings.findUnique({ where: { organizationId } });
    if (settings) {
      return {
        provider: settings.provider as EmailProvider,
        fromName: settings.fromName,
        fromEmail: settings.fromEmail,
        credentials: JSON.parse(decrypt(settings.credentials)),
      };
    }
  }

  return {
    provider: "smtp",
    fromName: "Mechanic Shop Hub",
    fromEmail: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
    credentials: {
      host: process.env.SMTP_HOST ?? "",
      port: Number(process.env.SMTP_PORT ?? 465),
      user: process.env.SMTP_USER ?? "",
      password: process.env.SMTP_PASSWORD ?? "",
    },
  };
}

async function sendViaResend(creds: ResendCredentials, from: string, to: string, subject: string, html: string) {
  const resend = new Resend(creds.apiKey);
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend: ${error.message}`);
}

async function sendViaSendGrid(creds: SendGridCredentials, from: string, to: string, subject: string, html: string) {
  sgMail.setApiKey(creds.apiKey);
  await sgMail.send({ from, to, subject, html });
}

async function sendViaSmtp(creds: SmtpCredentials, from: string, to: string, subject: string, html: string) {
  const transport = nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.port === 465,
    auth: { user: creds.user, pass: creds.password },
  });
  await transport.sendMail({ from, to, subject, html });
}

/**
 * Sends one email using whichever provider the given organization has
 * configured (Settings → Email), or the platform default if none is set.
 * `organizationId` is optional because some flows (e.g. a password reset
 * requested before we've resolved which shop the user belongs to) may not
 * have it handy — those fall back to the platform default automatically.
 */
export async function sendMail(params: { to: string; subject: string; html: string; organizationId?: string | null }) {
  const config = await resolveConfig(params.organizationId);
  const from = `${config.fromName} <${config.fromEmail}>`;

  switch (config.provider) {
    case "resend":
      return sendViaResend(config.credentials as ResendCredentials, from, params.to, params.subject, params.html);
    case "sendgrid":
      return sendViaSendGrid(config.credentials as SendGridCredentials, from, params.to, params.subject, params.html);
    case "smtp":
      return sendViaSmtp(config.credentials as SmtpCredentials, from, params.to, params.subject, params.html);
  }
}
