import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBillingDraft, draftBillingRows } from "./billing-draft.ts";
import { assembleCombinedInvoice, buildInvoiceFromRows } from "./invoice-lines.ts";

// Run with:  node --test src/lib/billing-draft.test.ts

const draft = (o: object = {}) => parseBillingDraft({ rows: [], partPrices: {}, partNoTax: {}, taxMode: "before", notes: "", ...o })!;

test("a draft is read back; anything that is not a draft is not", () => {
  assert.equal(parseBillingDraft(null), null);
  assert.equal(parseBillingDraft([]), null);
  assert.equal(parseBillingDraft("x"), null);
  const d = parseBillingDraft({ rows: [{ kind: "service", description: "Full service", quantity: "1", unitPrice: "180", taxable: true }, { kind: "bogus", description: "x" }], taxMode: "included", notes: "Belt replaced." })!;
  assert.equal(d.rows.length, 1);
  assert.equal(d.taxMode, "included");
  assert.equal(d.notes, "Belt replaced.");
});

test("rows come out in screen order, with the job's parts at their saved prices", () => {
  const d = draft({
    rows: [{ kind: "other", description: "Shop supplies", quantity: "1", unitPrice: "5", taxable: true }, { kind: "service", description: "Full service package", quantity: "1", unitPrice: "180", taxable: true }, { kind: "labour", description: "Labour", quantity: "1.5", unitPrice: "90", taxable: true }],
    partPrices: { p1: "9.50" },
  });
  const rows = draftBillingRows(d, [{ id: "p1", name: "Shear pin", quantity: 2, unitSellPrice: "7.00" }, { id: "p2", name: "Belt", quantity: 1, unitSellPrice: "30.00" }], false);
  assert.deepEqual(rows.map((r) => r.description), ["Labour", "Full service package", "Shear pin", "Belt", "Shop supplies"]);
  assert.equal(rows[2].unitPrice, 9.5); // the price typed on Billing
  assert.equal(rows[3].unitPrice, 30); // no price typed: the part's own
});

test("a half-filled row is left out", () => {
  const d = draft({ rows: [{ kind: "other", description: "Oil", quantity: "1", unitPrice: "", taxable: true }, { kind: "other", description: "", quantity: "1", unitPrice: "5", taxable: true }] });
  assert.deepEqual(draftBillingRows(d, [], false), []);
});

test("'no tax' by hand counts only for US shops; a saved no-tax service always keeps its flag", () => {
  const d = draft({
    rows: [{ kind: "labour", description: "Labour", quantity: "1", unitPrice: "90", taxable: false }, { kind: "service", description: "Inspection", quantity: "1", unitPrice: "50", taxable: false }],
    partNoTax: { p1: true },
  });
  const parts = [{ id: "p1", name: "Belt", quantity: 1, unitSellPrice: "30" }];
  const ca = draftBillingRows(d, parts, false);
  assert.deepEqual(ca.map((r) => r.taxable), [true, false, true]); // labour taxed, service keeps no-tax, part taxed
  const us = draftBillingRows(d, parts, true);
  assert.deepEqual(us.map((r) => r.taxable), [false, false, false]);
});

test("a merged invoice: a section and a note for each machine, totalled once", () => {
  const rate = 15;
  const m = buildInvoiceFromRows({ rows: draftBillingRows(draft({ rows: [{ kind: "service", description: "Spring tune-up package", quantity: "1", unitPrice: "89", taxable: true }] }), [{ id: "a", name: "Spark plug", quantity: 1, unitSellPrice: "7.00" }], false), taxIncluded: false, taxRate: rate });
  const s = buildInvoiceFromRows({ rows: draftBillingRows(draft({ rows: [{ kind: "service", description: "Full service package", quantity: "1", unitPrice: "180", taxable: true }] }), [{ id: "b", name: "Shear pin", quantity: 2, unitSellPrice: "7.00" }], false), taxIncluded: false, taxRate: rate });
  const merged = assembleCombinedInvoice([{ header: "Push mower", lines: m.lines, note: "Cleaned carb." }, { header: "Snowblower", lines: s.lines, note: "  " }], rate);
  assert.deepEqual(merged.lines.map((l) => l.type), ["header", "labor", "part", "note", "header", "labor", "part"]); // the blank note is dropped
  assert.deepEqual(merged.lines.map((l) => l.sortOrder), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(merged.totals, { subtotal: "290.00", taxAmount: "43.50", total: "333.50" });
  assert.equal(merged.lines[3].description, "Cleaned carb.");
  assert.equal(merged.lines[3].lineTotal, "0.00");
});

test("tax-included drafts are turned back to pre-tax prices before they are merged", () => {
  const rows = draftBillingRows(draft({ taxMode: "included", rows: [{ kind: "other", description: "Repair service", quantity: "1", unitPrice: "207", taxable: true }] }), [], false);
  const one = buildInvoiceFromRows({ rows, taxIncluded: true, taxRate: 15 });
  const merged = assembleCombinedInvoice([{ header: "Generator", lines: one.lines }], 15);
  assert.equal(merged.lines[1].unitPrice, "180.00");
  assert.deepEqual(merged.totals, { subtotal: "180.00", taxAmount: "27.00", total: "207.00" });
});
