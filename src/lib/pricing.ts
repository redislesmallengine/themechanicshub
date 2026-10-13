// Money rules for a flat price -- plain functions with no imports, so they can be tested on their own.
// computeTotals (src/lib/invoices.ts) works from line items; these decide what a line's price should be
// when the owner types the amount the customer actually paid, tax included.

const cents = (n: number) => Math.round(n * 100) / 100;

/** What an invoice with one taxable line of `net` comes to, worked out the same way computeTotals does (round at the end). */
function grossOf(net: number, ratePercent: number): number {
  return Number((net + net * (ratePercent / 100)).toFixed(2));
}

/**
 * The pre-tax price that makes an invoice with a single taxable line total exactly `gross` once
 * tax is added. $207.00 at 15% -> $180.00. Not every amount has an exact answer (some gross
 * figures fall between two whole-cent totals); then the closest price is used and the caller
 * gets `exact: false`, so the screen can say so rather than silently being a cent out.
 */
export function netForGross(gross: number, ratePercent: number): { net: number; exact: boolean } {
  if (!Number.isFinite(gross) || gross < 0) return { net: 0, exact: false };
  if (!ratePercent) return { net: cents(gross), exact: true };

  const start = cents(gross / (1 + ratePercent / 100));
  for (const step of [0, -0.01, 0.01, -0.02, 0.02]) {
    const net = cents(start + step);
    if (grossOf(net, ratePercent) === cents(gross)) return { net, exact: true };
  }
  return { net: start, exact: false };
}

/** The pre-tax unit price for a typed amount, depending on whether the amount includes tax. */
export function unitPriceFor(amount: number, taxIncluded: boolean, ratePercent: number): { unitPrice: number; exact: boolean } {
  if (!taxIncluded) return { unitPrice: cents(amount), exact: true };
  const { net, exact } = netForGross(amount, ratePercent);
  return { unitPrice: net, exact };
}

/**
 * An invoice that is one flat-priced line. When the amount includes tax, the TOTAL is the amount typed,
 * to the cent -- the tax figure absorbs any single-cent rounding (about one amount in eight has no whole-cent
 * pre-tax price that adds up exactly at 15%), so $207 always prints as $207.00. When tax is added on top it
 * follows the same arithmetic as computeTotals.
 */
export function flatPriceTotals(amount: number, taxIncluded: boolean, ratePercent: number): { unitPrice: number; subtotal: string; taxAmount: string; total: string } {
  if (taxIncluded) {
    const { net } = netForGross(amount, ratePercent);
    const total = cents(amount);
    return { unitPrice: net, subtotal: net.toFixed(2), taxAmount: cents(total - net).toFixed(2), total: total.toFixed(2) };
  }
  const net = cents(amount);
  const taxRaw = net * (ratePercent / 100);
  return { unitPrice: net, subtotal: net.toFixed(2), taxAmount: taxRaw.toFixed(2), total: (net + taxRaw).toFixed(2) };
}
