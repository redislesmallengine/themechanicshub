import { Prisma } from "@/generated/prisma/client";
import { shopTaxes, taxBreakdownFor } from "@/lib/taxes";

/** The value for Invoice.taxBreakdown: what the invoice's tax is made of under the shop's taxes today, or an empty value when the shop charges no tax. */
export function taxBreakdownField(taxAmount: string | number, profile: Parameters<typeof shopTaxes>[0]) {
  const breakdown = taxBreakdownFor(taxAmount, shopTaxes(profile));
  return breakdown ?? Prisma.DbNull;
}
