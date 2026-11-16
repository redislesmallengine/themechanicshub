// Money is always shown with two decimals: $129.00, not $129, and $623.30, not $623.3. The database hands back a Decimal whose
// toString() drops trailing zeros, so anything printed straight from it looks wrong.
export function money(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}
