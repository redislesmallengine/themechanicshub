import { test } from "node:test";
import assert from "node:assert/strict";
import { readBilling, buildInvoiceFromBilling, readExtraCharges, type Billing } from "./invoice-lines.ts";

// Run with:  node --test src/lib/invoice-lines.test.ts
const shop = { labourRate: "90", diagnosticFee: "45", taxRate: "15" };
const noParts: never[] = [];
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

test("the owner's $207 job: one flat line, $180.00 + $27.00 tax = $207.00", () => {
  const billing = readBilling(form({ billingMode: "flat", flatAmount: "207" }), "Spindles and pulleys") as Billing;
  assert.deepEqual(billing, { mode: "flat", amount: 207, taxIncluded: true, taxable: true, description: "Spindles and pulleys" });
  const { lines, totals } = buildInvoiceFromBilling({ billing, labourHours: null, parts: noParts, shopProfile: shop, fees: { includeDiagnosticFee: false, deliveryFee: null } });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].unitPrice, "180.00");
  assert.deepEqual(totals, { subtotal: "180.00", taxAmount: "27.00", total: "207.00" });
});

test("a flat price with tax added on top: $180 becomes $207", () => {
  const billing = readBilling(form({ billingMode: "flat", flatAmount: "180", flatTax: "extra" }), "") as Billing;
  const { totals } = buildInvoiceFromBilling({ billing, labourHours: null, parts: noParts, shopProfile: shop, fees: { includeDiagnosticFee: false, deliveryFee: null } });
  assert.deepEqual(totals, { subtotal: "180.00", taxAmount: "27.00", total: "207.00" });
});

test("fees ticked on a flat price are added after it and taxed on top", () => {
  const billing = readBilling(form({ billingMode: "flat", flatAmount: "207" }), "") as Billing;
  const { lines, totals } = buildInvoiceFromBilling({ billing, labourHours: null, parts: noParts, shopProfile: shop, fees: { includeDiagnosticFee: true, deliveryFee: null } });
  assert.equal(lines.length, 2);
  assert.equal(lines[1].description, "Diagnostic Fee");
  assert.deepEqual(totals, { subtotal: "225.00", taxAmount: "33.75", total: "258.75" });
});

test("a service saved as 'no tax' is billed without tax", () => {
  const billing = readBilling(form({ billingMode: "flat", flatAmount: "100", flatTax: "extra", flatTaxable: "off" }), "Safety inspection") as Billing;
  const { lines, totals } = buildInvoiceFromBilling({ billing, labourHours: null, parts: noParts, shopProfile: shop, fees: { includeDiagnosticFee: false, deliveryFee: null } });
  assert.equal(lines[0].taxable, false);
  assert.deepEqual(totals, { subtotal: "100.00", taxAmount: "0.00", total: "100.00" });
});

test("by hours and parts still works as before: 1 hr at $90 plus a $6.99 part", () => {
  const { lines, totals } = buildInvoiceFromBilling({
    billing: { mode: "hours" },
    labourHours: "1",
    parts: [{ name: "NGK spark plug", quantity: 1, unitSellPrice: "6.99", unitCostPrice: "3.00" }],
    shopProfile: shop,
    fees: { includeDiagnosticFee: false, deliveryFee: null },
  });
  assert.equal(lines.length, 2);
  assert.deepEqual(totals, { subtotal: "96.99", taxAmount: "14.55", total: "111.54" });
});

test("flat billing needs an amount", () => {
  assert.deepEqual(readBilling(form({ billingMode: "flat", flatAmount: "" }), ""), { error: "Enter the amount charged, for example 207.00." });
  assert.deepEqual(readBilling(form({ billingMode: "flat", flatAmount: "0" }), ""), { error: "Enter the amount charged, for example 207.00." });
});

test("anything that isn't flat is billed by hours and parts", () => {
  assert.deepEqual(readBilling(form({}), ""), { mode: "hours" });
  assert.deepEqual(readBilling(form({ billingMode: "hours" }), ""), { mode: "hours" });
});

test("extra charges are added after the price, each taxable", () => {
  const billing = readBilling(form({ billingMode: "flat", flatAmount: "207" }), "") as Billing;
  const extras = readExtraCharges(form({ extraCharges: JSON.stringify([{ description: "New oil", amount: "10" }, { description: "", amount: "" }]) }));
  assert.deepEqual(extras, { items: [{ description: "New oil", amount: 10 }] });
  const { lines, totals } = buildInvoiceFromBilling({ billing, labourHours: null, parts: noParts, shopProfile: shop, fees: { includeDiagnosticFee: false, deliveryFee: null }, extras: (extras as { items: { description: string; amount: number }[] }).items });
  assert.equal(lines.length, 2);
  assert.equal(lines[1].description, "New oil");
  assert.equal(lines[1].type, "custom");
  // $207.00 (tax included) + $10.00 + $1.50 tax on it
  assert.deepEqual(totals, { subtotal: "190.00", taxAmount: "28.50", total: "218.50" });
});

test("extra charges alone make a bill by hours work too, and bad rows are refused", () => {
  const { lines, totals } = buildInvoiceFromBilling({ billing: { mode: "hours" }, labourHours: null, parts: noParts, shopProfile: shop, fees: { includeDiagnosticFee: false, deliveryFee: null }, extras: [{ description: "Shop supplies", amount: 20 }] });
  assert.equal(lines.length, 1);
  assert.deepEqual(totals, { subtotal: "20.00", taxAmount: "3.00", total: "23.00" });
  assert.deepEqual(readExtraCharges(form({})), { items: [] });
  assert.ok("error" in readExtraCharges(form({ extraCharges: "nope" })));
  assert.ok("error" in readExtraCharges(form({ extraCharges: JSON.stringify([{ description: "Oil", amount: "" }]) })));
  assert.ok("error" in readExtraCharges(form({ extraCharges: JSON.stringify([{ description: "", amount: "5" }]) })));
});

// ---- the Billing screen's rows

import { buildInvoiceFromRows, readBillingRows } from "./invoice-lines.ts";

test("rows, prices before tax: tax is added on top", () => {
  const { lines, totals } = buildInvoiceFromRows({
    rows: [
      { kind: "labour", description: "Labour", quantity: 2, unitPrice: 90, taxable: true },
      { kind: "part", description: "Spark plug", quantity: 2, unitPrice: 6.5, taxable: true },
    ],
    taxIncluded: false,
    taxRate: 15,
  });
  assert.equal(lines.length, 2);
  assert.deepEqual(totals, { subtotal: "193.00", taxAmount: "28.95", total: "221.95" });
});

test("rows, tax included: one $207 row totals exactly $207.00", () => {
  const { lines, totals } = buildInvoiceFromRows({ rows: [{ kind: "other", description: "Repair service", quantity: 1, unitPrice: 207, taxable: true }], taxIncluded: true, taxRate: 15 });
  assert.equal(lines[0].unitPrice, "180.00");
  assert.deepEqual(totals, { subtotal: "180.00", taxAmount: "27.00", total: "207.00" });
});

test("rows, tax included, several rows: the total is what was typed to the cent", () => {
  const { totals } = buildInvoiceFromRows({
    rows: [
      { kind: "labour", description: "Labour", quantity: 1.5, unitPrice: 103.5, taxable: true },
      { kind: "part", description: "Belt", quantity: 3, unitPrice: 11.49, taxable: true },
      { kind: "service", description: "Safety inspection", quantity: 1, unitPrice: 20, taxable: false },
    ],
    taxIncluded: true,
    taxRate: 15,
  });
  assert.equal(totals.total, "209.72");
  assert.equal((Number(totals.subtotal) + Number(totals.taxAmount)).toFixed(2), totals.total);
});

test("a no-tax row is never taxed, with tax added or included", () => {
  const rows = [{ kind: "service" as const, description: "Safety inspection", quantity: 1, unitPrice: 100, taxable: false }];
  assert.deepEqual(buildInvoiceFromRows({ rows, taxIncluded: false, taxRate: 15 }).totals, { subtotal: "100.00", taxAmount: "0.00", total: "100.00" });
  assert.deepEqual(buildInvoiceFromRows({ rows, taxIncluded: true, taxRate: 15 }).totals, { subtotal: "100.00", taxAmount: "0.00", total: "100.00" });
});

test("reading rows: blanks are skipped, a half-filled row is explained", () => {
  const ok = readBillingRows(form({ billingRows: JSON.stringify([{ kind: "other", description: "", unitPrice: "", quantity: 1 }, { kind: "labour", description: "Labour", quantity: 1, unitPrice: "90" }]) }));
  assert.ok("rows" in ok && ok.rows.length === 1);
  const bad = readBillingRows(form({ billingRows: JSON.stringify([{ kind: "other", description: "Oil", quantity: 1, unitPrice: "" }]) }));
  assert.ok("error" in bad && bad.error.includes("Oil"));
});
