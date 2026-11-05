// A shop can charge several taxes (GST + PST, or state + county + city). Every tax applies to every taxable line, so the
// invoice total is worked out once with the combined rate and the result is then split between the taxes. Plain
// functions with no imports, so they can be tested on their own.

export type TaxDef = { name: string; rate: number };
export type TaxLine = { name: string; rate: number; amount: string };

const cents = (n: number) => Math.round(n * 100) / 100;

/** Reads a shop's taxes: the `taxes` list when it has one, else the single tax in taxLabel/taxRate (no tax at all when the rate is 0). */
export function shopTaxes(profile: { taxes?: unknown; taxLabel?: string | null; taxRate?: { toString(): string } | number | string | null } | null | undefined): TaxDef[] {
  const list = profile?.taxes;
  if (Array.isArray(list) && list.length > 0) {
    const out: TaxDef[] = [];
    for (const t of list) {
      const name = String((t as { name?: unknown })?.name ?? "").trim();
      const rate = Number((t as { rate?: unknown })?.rate);
      if (name && Number.isFinite(rate) && rate >= 0) out.push({ name, rate });
    }
    if (out.length > 0) return out;
  }
  const rate = Number(profile?.taxRate ?? 0);
  if (!(rate > 0)) return [];
  return [{ name: (profile?.taxLabel ?? "").trim() || "Tax", rate }];
}

/** The rate all the taxes add up to, which is what totals are worked out with. */
export function combinedRate(taxes: TaxDef[]): number {
  return cents(taxes.reduce((sum, t) => sum + t.rate, 0) * 100) / 100;
}

/** What the taxes are called together, e.g. "GST + PST". */
export function combinedLabel(taxes: TaxDef[]): string {
  return taxes.map((t) => t.name).join(" + ");
}

/**
 * Splits a tax total between the taxes in proportion to their rates, in whole cents, with the last one taking any leftover
 * cent so the lines always add up to exactly `totalTax`.
 */
export function allocateTax(totalTax: number, taxes: TaxDef[]): TaxLine[] {
  if (taxes.length === 0) return [];
  const rates = taxes.reduce((sum, t) => sum + t.rate, 0);
  let left = cents(totalTax);
  return taxes.map((t, i) => {
    const amount = i === taxes.length - 1 || !(rates > 0) ? left : cents((totalTax * t.rate) / rates);
    left = cents(left - amount);
    return { name: t.name, rate: t.rate, amount: amount.toFixed(2) };
  });
}

/** The breakdown saved on an invoice: the shop's taxes with the amount of each. Null when the shop charges no tax. */
export function taxBreakdownFor(totalTax: string | number, taxes: TaxDef[]): TaxLine[] | null {
  const lines = allocateTax(Number(totalTax), taxes);
  return lines.length > 0 ? lines : null;
}

/** Reads a saved breakdown back, or null if it is missing or malformed (older invoices). */
export function readTaxBreakdown(value: unknown): TaxLine[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: TaxLine[] = [];
  for (const t of value) {
    const name = String((t as { name?: unknown })?.name ?? "");
    const rate = Number((t as { rate?: unknown })?.rate);
    const amount = String((t as { amount?: unknown })?.amount ?? "");
    if (!name || !Number.isFinite(rate) || amount === "" || !Number.isFinite(Number(amount))) return null;
    out.push({ name, rate, amount });
  }
  return out;
}

/**
 * The tax lines to show for an invoice: the saved breakdown, or for an older invoice one line made from the shop's tax
 * label and rate and the invoice's tax amount.
 */
export function invoiceTaxLines(invoice: { taxBreakdown?: unknown; taxAmount: { toString(): string } | string | number }, profile: { taxLabel?: string | null; taxRate?: { toString(): string } | number | string | null } | null | undefined): TaxLine[] {
  const saved = readTaxBreakdown(invoice.taxBreakdown);
  if (saved) return saved;
  return [{ name: (profile?.taxLabel ?? "").trim() || "Tax", rate: Number(profile?.taxRate ?? 0), amount: Number(invoice.taxAmount.toString()).toFixed(2) }];
}

/** Whether a line can be marked "no tax" by hand: only for shops in the US, where some states don't tax repair labour. */
export function canMarkNoTax(country: string | null | undefined): boolean {
  return country === "US";
}

/** "GST (5%)", or just the name when the rate isn't known. */
export function taxLineLabel(line: { name: string; rate: number }): string {
  return line.rate > 0 ? `${line.name} (${line.rate}%)` : line.name;
}
