import { test } from "node:test";
import assert from "node:assert/strict";
import { shopTaxes, combinedRate, combinedLabel, allocateTax, taxBreakdownFor, readTaxBreakdown, invoiceTaxLines, canMarkNoTax } from "./taxes.ts";

// Run with:  node --test src/lib/taxes.test.ts

test("a shop with no taxes list uses its single tax", () => {
  assert.deepEqual(shopTaxes({ taxLabel: "HST", taxRate: "15.00" }), [{ name: "HST", rate: 15 }]);
  assert.deepEqual(shopTaxes({ taxLabel: null, taxRate: 7 }), [{ name: "Tax", rate: 7 }]);
  assert.deepEqual(shopTaxes({ taxLabel: "HST", taxRate: 0 }), []);
  assert.deepEqual(shopTaxes(null), []);
});

test("a shop with a taxes list uses it, ignoring broken rows", () => {
  const taxes = shopTaxes({ taxes: [{ name: "GST", rate: 5 }, { name: "", rate: 3 }, { name: "PST", rate: "7" }, { name: "Bad", rate: "x" }], taxLabel: "old", taxRate: 99 });
  assert.deepEqual(taxes, [{ name: "GST", rate: 5 }, { name: "PST", rate: 7 }]);
  assert.equal(combinedRate(taxes), 12);
  assert.equal(combinedLabel(taxes), "GST + PST");
});

test("the combined rate has no floating point crumbs", () => {
  assert.equal(combinedRate([{ name: "State", rate: 6.25 }, { name: "County", rate: 1 }, { name: "City", rate: 1 }]), 8.25);
  assert.equal(combinedRate([{ name: "A", rate: 0.1 }, { name: "B", rate: 0.2 }]), 0.3);
});

test("a tax total is split in proportion and always adds up", () => {
  const lines = allocateTax(2.23, [{ name: "State", rate: 6.25 }, { name: "County", rate: 1 }, { name: "City", rate: 1 }]);
  assert.equal(lines.length, 3);
  assert.equal(lines.reduce((s, l) => s + Number(l.amount), 0).toFixed(2), "2.23");
  assert.deepEqual(lines.map((l) => l.name), ["State", "County", "City"]);
});

test("GST 5% and PST 7% on $162: 8.10 and 11.34", () => {
  const lines = allocateTax(19.44, [{ name: "GST", rate: 5 }, { name: "PST", rate: 7 }]);
  assert.deepEqual(lines.map((l) => l.amount), ["8.10", "11.34"]);
});

test("one tax gets the whole amount", () => {
  assert.deepEqual(allocateTax(24.3, [{ name: "HST", rate: 15 }]), [{ name: "HST", rate: 15, amount: "24.30" }]);
  assert.equal(taxBreakdownFor("0", []), null);
});

test("a saved breakdown is read back, a broken one is not", () => {
  const saved = [{ name: "GST", rate: 5, amount: "8.10" }];
  assert.deepEqual(readTaxBreakdown(saved), saved);
  assert.equal(readTaxBreakdown(null), null);
  assert.equal(readTaxBreakdown([{ name: "GST", rate: 5 }]), null);
});

test("an older invoice shows one line from the shop's label and rate", () => {
  assert.deepEqual(invoiceTaxLines({ taxAmount: "24.3" }, { taxLabel: "HST", taxRate: "15" }), [{ name: "HST", rate: 15, amount: "24.30" }]);
  assert.deepEqual(invoiceTaxLines({ taxAmount: "9", taxBreakdown: [{ name: "GST", rate: 5, amount: "9.00" }] }, null), [{ name: "GST", rate: 5, amount: "9.00" }]);
});

test("only US shops can mark a line no tax", () => {
  assert.equal(canMarkNoTax("US"), true);
  assert.equal(canMarkNoTax("CA"), false);
  assert.equal(canMarkNoTax(null), false);
});
