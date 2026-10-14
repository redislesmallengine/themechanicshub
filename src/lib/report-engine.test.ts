import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyLine, resolvePreset, previousRange, periodsOf, periodKey, shapeInvoice, shapeAll, datasetFor, emptyFilters, buildIncome, buildSales, buildHst,
  type ReportInvoice, type ReportLine,
} from "./report-engine.ts";

// Run with:  node --test src/lib/report-engine.test.ts

const line = (type: ReportLine["type"], total: number, o: Partial<ReportLine> = {}): ReportLine => ({ type, description: type, qty: 1, unitPrice: total, unitCost: null, taxable: true, total, partNumber: null, partCategory: null, ...o });

function inv(o: Partial<ReportInvoice> & { lines: ReportLine[] }): ReportInvoice {
  const subtotal = o.lines.reduce((t, l) => t + l.total, 0);
  const taxableBase = o.lines.filter((l) => l.taxable).reduce((t, l) => t + l.total, 0);
  const tax = Math.round(taxableBase * 15) / 100;
  return {
    id: o.number ?? "x", number: "INV-1", issued: "2026-10-05", paid: null, due: "2026-10-19", state: "Unpaid", method: "", reference: "", customerId: "c1", customer: "Judy", customerType: "Repeat",
    machineType: "Riding mower", make: "John Deere", model: "X300", tech: "Mark", job: "Normal job", arrival: "Customer drop-off", payer: "Customer", provider: "",
    subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100, taxableBase, ...o,
  };
}

const A = inv({ number: "INV-1", issued: "2026-10-05", paid: "2026-10-05", state: "Paid", method: "Card", lines: [line("Labour", 170, { qty: 2, unitPrice: 85 }), line("Parts", 40, { unitCost: 20, partNumber: "BKR6E", partCategory: "Ignition" })] });
const B = inv({ number: "INV-2", issued: "2026-10-06", paid: "2026-10-09", state: "Paid", method: "E-transfer", customer: "Dave", tech: "Kyle", lines: [line("Services (flat price)", 100)] });
const C = inv({ number: "INV-3", issued: "2026-10-07", state: "Overdue", due: "2026-10-01", lines: [line("Labour", 85, { qty: 1, unitPrice: 85 }), line("Fees", 22, { taxable: false })] });
const D = inv({ number: "INV-4", issued: "2026-10-08", state: "Void", lines: [line("Parts", 50, { unitCost: 25 })] });
const E = inv({ number: "INV-5", issued: "2026-09-20", paid: "2026-09-21", state: "Paid", method: "Cash", payer: "Warranty", provider: "Stihl Canada", lines: [line("Labour", 100, { qty: 1, unitPrice: 100 })] });
const ALL = [A, B, C, D, E];
const OCT = { from: "2026-10-01", to: "2026-10-14" };

test("an hourly labour line is Labour, any other labour line is a flat-price service", () => {
  assert.equal(classifyLine("labor", "Labor (2 hrs @ $85.00/hr)"), "Labour");
  assert.equal(classifyLine("labor", "Mower annual service"), "Services (flat price)");
  assert.equal(classifyLine("part", "Spark plug"), "Parts");
  assert.equal(classifyLine("fee", "Diagnostic Fee"), "Fees");
  assert.equal(classifyLine("custom", "Shop supplies"), "Other");
  assert.equal(classifyLine("header", "Riding mower"), null);
});

test("date presets", () => {
  assert.deepEqual(resolvePreset("month", undefined, undefined, "2026-10-14"), { from: "2026-10-01", to: "2026-10-14" });
  assert.deepEqual(resolvePreset("last-month", undefined, undefined, "2026-01-10"), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(resolvePreset("last-month", undefined, undefined, "2026-03-31"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(resolvePreset("quarter", undefined, undefined, "2026-10-14"), { from: "2026-10-01", to: "2026-10-14" });
  assert.deepEqual(resolvePreset("last-quarter", undefined, undefined, "2026-01-15"), { from: "2025-10-01", to: "2025-12-31" });
  assert.deepEqual(resolvePreset("last-quarter", undefined, undefined, "2026-10-14"), { from: "2026-07-01", to: "2026-09-30" });
  assert.deepEqual(resolvePreset("last-year", undefined, undefined, "2026-10-14"), { from: "2025-01-01", to: "2025-12-31" });
  assert.deepEqual(resolvePreset("week", undefined, undefined, "2026-10-14"), { from: "2026-10-12", to: "2026-10-14" }); // a Wednesday
  assert.deepEqual(resolvePreset("custom", "2026-10-09", "2026-10-02", "2026-10-14"), { from: "2026-10-02", to: "2026-10-09" });
});

test("the period before has the same length and ends the day before", () => {
  assert.deepEqual(previousRange(OCT), { from: "2026-09-17", to: "2026-09-30" });
  assert.deepEqual(previousRange({ from: "2026-10-14", to: "2026-10-14" }), { from: "2026-10-13", to: "2026-10-13" });
});

test("weeks start on Monday and months group by month", () => {
  assert.equal(periodKey("2026-10-14", "week"), "2026-10-12");
  assert.equal(periodKey("2026-10-18", "week"), "2026-10-12");
  assert.deepEqual(periodsOf({ from: "2026-10-01", to: "2026-10-14" }, "week"), ["2026-09-28", "2026-10-05", "2026-10-12"]);
  assert.deepEqual(periodsOf({ from: "2026-09-20", to: "2026-10-14" }, "month"), ["2026-09", "2026-10"]);
});

test("an invoice with no line filter is exactly as stored; a line filter shares the tax out by taxable lines", () => {
  const whole = shapeInvoice(C, emptyFilters())!;
  assert.equal(whole.sub, C.subtotal);
  assert.equal(whole.tax, C.tax);
  assert.equal(whole.nontax, 22);
  const f = emptyFilters();
  f.sets.ltype = ["Labour"];
  const labour = shapeInvoice(C, f)!;
  assert.equal(labour.sub, 85);
  assert.equal(labour.tax, C.tax); // the labour line carries all of the tax
  f.sets.ltype = ["Fees"];
  const fees = shapeInvoice(C, f)!;
  assert.equal(fees.tax, 0);
  f.sets.ltype = ["Services (flat price)"];
  assert.equal(shapeInvoice(C, f), null);
});

test("invoice filters narrow what each report sees, status filter only where it applies", () => {
  const f = emptyFilters();
  f.sets.tech = ["Kyle"];
  assert.deepEqual(shapeAll(ALL, f, "sales").map((s) => s.inv.number), ["INV-2"]);
  const g = emptyFilters();
  g.sets.state = ["Overdue"];
  assert.equal(shapeAll(ALL, g, "income").length, 5); // status is not a filter on Income
  assert.deepEqual(shapeAll(ALL, g, "sales").map((s) => s.inv.number), ["INV-3"]);
  const h = emptyFilters();
  h.min = 100; h.max = 200;
  const inside = ALL.filter((i) => i.total >= 100 && i.total <= 200).map((i) => i.number).sort();
  assert.deepEqual(shapeAll(ALL, h, "sales").map((s) => s.inv.number).sort(), inside);
});

test("each report picks its invoices by its own date", () => {
  const all = shapeAll(ALL, emptyFilters(), "sales");
  assert.deepEqual(datasetFor("income", all, OCT).map((s) => s.inv.number).sort(), ["INV-1", "INV-2"]);
  assert.deepEqual(datasetFor("sales", all, OCT).map((s) => s.inv.number).sort(), ["INV-1", "INV-2", "INV-3"]); // the void one is left out
  assert.deepEqual(datasetFor("hst", all, { from: "2026-10-09", to: "2026-10-09" }, "payment").map((s) => s.inv.number), ["INV-2"]);
  assert.deepEqual(datasetFor("hst", all, { from: "2026-10-06", to: "2026-10-06" }, "invoice").map((s) => s.inv.number), ["INV-2"]);
});

test("Income: money received, what is still owed, and how late it is", () => {
  const r = buildIncome(shapeAll(ALL, emptyFilters(), "income"), OCT, true, "day", "2026-10-14");
  assert.equal(r.payments.value, 2);
  assert.equal(r.received.value, A.total + B.total);
  assert.equal(r.received.previous, E.total); // the invoice paid in the period before
  assert.equal(r.owed.count, 1);
  assert.equal(r.owed.overdueCount, 1);
  assert.equal(r.byMethod.reduce((t, m) => t + m.a, 0), r.received.value);
  assert.equal(r.chart.series.reduce((t, s) => t + s.values.reduce((a, b) => a + b, 0), 0), r.received.value);
  assert.equal(r.details.rows.length, 2);
});

test("Income aging puts a 13-day-late invoice in the 1 to 30 bucket", () => {
  const r = buildIncome(shapeAll(ALL, emptyFilters(), "income"), OCT, false, "day", "2026-10-14");
  assert.equal(r.aging.find((a) => a.label === "1 to 30 days late")!.count, 1);
  assert.equal(r.previous, null);
});

test("Sales: before-tax totals, by type, margin and the summaries add up", () => {
  const r = buildSales(shapeAll(ALL, emptyFilters(), "sales"), OCT, false, "week", "customer", "invoice");
  assert.equal(r.invoices.value, 3);
  assert.equal(r.sales.value, A.subtotal + B.subtotal + C.subtotal);
  assert.equal(r.hours, 3); // 2 + 1 hours of hourly labour
  assert.equal(r.partsRev, 40);
  assert.equal(r.partsRevCosted, 40);
  assert.equal(r.partsCost, 20);
  assert.equal(r.summary.reduce((t, g) => t + g.a, 0), r.sales.value);
  assert.equal(r.chart.series.reduce((t, s) => t + s.values.reduce((a, b) => a + b, 0), 0), r.sales.value);
  assert.equal(r.topParts[0].number, "BKR6E");
  assert.equal(r.topServices[0].name, "Services (flat price)");
  const byType = buildSales(shapeAll(ALL, emptyFilters(), "sales"), OCT, false, "day", "ltype", "line");
  assert.equal(byType.summary.reduce((t, g) => t + g.a, 0), byType.sales.value);
  assert.equal(byType.details.rows.length, 5); // every non-header line of the three invoices
});

test("Sales margin ignores parts whose cost is unknown", () => {
  const unknown = inv({ number: "INV-9", lines: [line("Parts", 100, { unitCost: null })] });
  const r = buildSales(shapeAll([A, unknown], emptyFilters(), "sales"), OCT, false, "day", "customer", "invoice");
  assert.equal(r.partsRev, 140);
  assert.equal(r.partsRevCosted, 40);
  assert.equal(r.partsCost, 20);
});

test("HST: collected, taxable and not taxable, credits estimate, voids and unpaid tax", () => {
  const r = buildHst(shapeAll(ALL, emptyFilters(), "hst"), OCT, true, "day", "invoice", 0.15, "2026-10-14");
  assert.equal(r.collected.value, A.tax + B.tax + C.tax);
  assert.equal(r.taxableSales, A.taxableBase + B.taxableBase + C.taxableBase);
  assert.equal(r.nonTaxableSales, 22);
  assert.equal(r.sales, r.taxableSales + r.nonTaxableSales);
  assert.equal(r.credits, Math.round(20 * 0.15 * 100) / 100);
  assert.equal(r.net, Math.round((r.collected.value - r.credits) * 100) / 100);
  assert.equal(r.voidedCount, 1);
  assert.equal(r.voidedTax, D.tax);
  assert.equal(r.unpaidTax, C.tax); // only INV-3 is unpaid
  assert.equal(r.linesMissingTax, 0);
  assert.equal(r.collected.previous, E.tax);
  const noCredit = buildHst(shapeAll(ALL, emptyFilters(), "hst"), OCT, false, "day", "invoice", null, "2026-10-14");
  assert.equal(noCredit.credits, 0);
  assert.equal(noCredit.net, noCredit.collected.value);
});

test("HST on the payment basis counts only paid invoices, on the day they were paid", () => {
  const r = buildHst(shapeAll(ALL, emptyFilters(), "hst"), OCT, false, "day", "payment", null, "2026-10-14");
  assert.equal(r.collected.value, A.tax + B.tax);
  assert.equal(r.unpaidTax, 0);
  assert.equal(r.details.rows.length, 2);
});
