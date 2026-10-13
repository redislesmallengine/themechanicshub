import { test } from "node:test";
import assert from "node:assert/strict";
import { readBilling, buildInvoiceFromBilling, type Billing } from "./invoice-lines.ts";

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
