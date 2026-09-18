import { prisma } from "@/lib/prisma";

/**
 * Every email the app sends is a "template" a shop can customize — same
 * merge-tag pattern used by Shopify/Stripe/Mailchimp/SendGrid for exactly
 * this ("let an admin customize a transactional email"): a flat
 * `{{token_name}}` placeholder syntax (no logic/conditionals — that's a
 * much bigger, riskier surface for a hand-rolled template engine, and
 * isn't needed for what these emails actually say), a documented list of
 * available tokens per template, and a hard requirement that certain
 * tokens (the actual link the email exists to deliver) can't be edited
 * away, because a customer who can't act on the email defeats the point of
 * sending it.
 *
 * No saved EmailTemplate row for a given key = that email still renders
 * from the defaults below, byte-for-byte what it always sent before this
 * feature existed.
 */
export const EMAIL_TEMPLATE_KEYS = ["estimate", "invoice", "lowStock", "staffInvite", "passwordReset", "testEmail"] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export interface EmailTemplateToken {
  token: string;
  description: string;
}

export interface EmailTemplateMeta {
  label: string;
  description: string;
  tokens: EmailTemplateToken[];
  /** Tokens that must remain present (as literal `{{token}}`) somewhere in the subject+body — saving is blocked otherwise. */
  requiredTokens: string[];
  defaultSubject: string;
  defaultHtml: string;
  /** Realistic stand-in values for the live preview on the settings page, where there's no real work order/invoice/part behind the template. */
  sampleData: Record<string, string>;
}

export const EMAIL_TEMPLATE_META: Record<EmailTemplateKey, EmailTemplateMeta> = {
  estimate: {
    label: "Repair Estimate",
    description: "Sent when staff send a work order's estimate to a customer for approval.",
    tokens: [
      { token: "customer_name", description: "Customer's name" },
      { token: "shop_name", description: "Your shop's name" },
      { token: "equipment_label", description: "Make/model of the equipment" },
      { token: "amount", description: "Estimate amount, e.g. $145.00" },
      { token: "estimate_notes", description: "What the estimate covers, in plain language" },
      { token: "approval_link", description: "Link for the customer to approve or decline — required" },
    ],
    requiredTokens: ["approval_link"],
    defaultSubject: "Repair estimate for {{equipment_label}} — {{shop_name}}",
    defaultHtml: `<p>Here's the estimate for {{equipment_label}}:</p>
<p><b>{{amount}}</b> — {{estimate_notes}}</p>
<p><a href="{{approval_link}}">Review and approve or decline</a></p>
<p>If you'd rather talk it through, just give the shop a call.</p>`,
    sampleData: {
      customer_name: "Jordan Smith",
      equipment_label: "Honda GX160",
      amount: "$145.00",
      estimate_notes: "Carburetor rebuild and a new spark plug",
      approval_link: "https://example.com/estimate/sample-link",
    },
  },
  invoice: {
    label: "Invoice",
    description: "Sent when staff send an invoice to a customer.",
    tokens: [
      { token: "customer_name", description: "Customer's name" },
      { token: "shop_name", description: "Your shop's name" },
      { token: "invoice_number", description: "Invoice number, e.g. INV-1009" },
      { token: "total", description: "Total amount due, e.g. $312.40" },
      { token: "invoice_link", description: "Link for the customer to view/pay the invoice — required" },
    ],
    requiredTokens: ["invoice_link"],
    defaultSubject: "Invoice {{invoice_number}} from {{shop_name}}",
    defaultHtml: `<p>Your invoice is ready — total due: <b>{{total}}</b>.</p>
<p><a href="{{invoice_link}}">View your invoice</a></p>
<p>A PDF copy is attached.</p>`,
    sampleData: {
      customer_name: "Jordan Smith",
      invoice_number: "INV-1009",
      total: "$312.40",
      invoice_link: "https://example.com/invoice/sample-link",
    },
  },
  lowStock: {
    label: "Low Stock Alert",
    description: "Sent to the shop Owner whenever a part's stock drops to or below its reorder point.",
    tokens: [
      { token: "part_name", description: "Part name" },
      { token: "sku", description: "Part SKU (shows \"—\" if none is set)" },
      { token: "quantity", description: "Current quantity on hand" },
      { token: "reorder_point", description: "Configured reorder point" },
      { token: "shop_name", description: "Your shop's name" },
    ],
    requiredTokens: [],
    defaultSubject: "Low stock: {{part_name}}",
    defaultHtml: `<p><b>{{part_name}}</b> (SKU: {{sku}}) is down to <b>{{quantity}}</b> — at or below its reorder point of {{reorder_point}}.</p>
<p>Restock when you get a chance.</p>`,
    sampleData: { part_name: "Spark Plug — NGK BPR6ES", sku: "SP-4402", quantity: "2", reorder_point: "5" },
  },
  staffInvite: {
    label: "Staff Invite",
    description: "Sent when an Owner/Manager invites someone to join the shop.",
    tokens: [
      { token: "inviter_name", description: "The staff member sending the invite" },
      { token: "shop_name", description: "Your shop's name" },
      { token: "role_label", description: "The role they're being invited as, e.g. Technician" },
      { token: "invite_link", description: "Link to accept the invite — required" },
    ],
    requiredTokens: ["invite_link"],
    defaultSubject: "You're invited to join {{shop_name}} on Mechanic Shop Hub",
    defaultHtml: `<p>{{inviter_name}} invited you to join <b>{{shop_name}}</b> as a <b>{{role_label}}</b>.</p>
<p><a href="{{invite_link}}">Accept the invite</a></p>`,
    sampleData: { inviter_name: "Junaid", role_label: "Technician", invite_link: "https://example.com/accept-invite/sample-link" },
  },
  passwordReset: {
    label: "Password Reset",
    description: "Sent when someone requests a password reset from the sign-in page.",
    tokens: [
      { token: "user_name", description: "The account holder's name" },
      { token: "reset_link", description: "Link to reset the password — required" },
    ],
    requiredTokens: ["reset_link"],
    defaultSubject: "Reset your Mechanic Shop Hub password",
    defaultHtml: `<p>Someone requested a password reset for your account.</p>
<p><a href="{{reset_link}}">Reset your password</a></p>
<p>If this wasn't you, you can ignore this email.</p>`,
    sampleData: { user_name: "Junaid", reset_link: "https://example.com/reset-password/sample-link" },
  },
  testEmail: {
    label: "Test Email",
    description: "Sent to yourself from Settings → Email → Send Test Email, to confirm a provider is working.",
    tokens: [{ token: "shop_name", description: "Your shop's name" }],
    requiredTokens: [],
    defaultSubject: "Mechanic Shop Hub — test email",
    defaultHtml: `<p>This is a test email from your Mechanic Shop Hub email settings. If you got this, it's working.</p>`,
    sampleData: {},
  },
};

/** Replaces every {{token}} with data[token]; a token with no matching key is left as-is rather than silently blanked, so a typo is visible instead of disappearing. */
export function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in data ? data[key] : match));
}

/** Which of a template's requiredTokens are missing from the given subject+html (checked as literal `{{token}}` substrings, not rendered output). */
export function findMissingRequiredTokens(key: EmailTemplateKey, subject: string, html: string): string[] {
  const combined = `${subject}\n${html}`;
  return EMAIL_TEMPLATE_META[key].requiredTokens.filter((token) => !combined.includes(`{{${token}}}`));
}

/** The subject/html a given org would actually send for this template right now — their saved override, or the built-in default. */
export async function loadEmailTemplate(organizationId: string, key: EmailTemplateKey): Promise<{ subject: string; html: string; isCustom: boolean }> {
  const meta = EMAIL_TEMPLATE_META[key];
  const row = await prisma.emailTemplate.findUnique({ where: { organizationId_key: { organizationId, key } } });
  if (!row) return { subject: meta.defaultSubject, html: meta.defaultHtml, isCustom: false };
  return { subject: row.subject, html: row.html, isCustom: true };
}

export async function saveEmailTemplateOverride(organizationId: string, key: EmailTemplateKey, subject: string, html: string) {
  await prisma.emailTemplate.upsert({
    where: { organizationId_key: { organizationId, key } },
    create: { organizationId, key, subject, html },
    update: { subject, html },
  });
}

export async function deleteEmailTemplateOverride(organizationId: string, key: EmailTemplateKey) {
  await prisma.emailTemplate.deleteMany({ where: { organizationId, key } });
}

/**
 * A crude but effective automatic plain-text fallback — every major ESP
 * either requires this or strongly recommends it for deliverability/
 * accessibility, and these emails are simple enough (a couple of
 * paragraphs, one link) that hand-authoring a second version per template
 * would be pure busywork for no real benefit over just deriving it.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
