import { test } from "node:test";
import assert from "node:assert/strict";
import { netForGross, unitPriceFor, flatPriceTotals } from "./pricing.ts";

// Run with:  node --test src/lib/pricing.test.ts

const total = (net: number, rate: number) => Number((net + net * (rate / 100)).toFixed(2));

test("the owner's $207 job at 15% HST is $180 + $27", () => {
  const { net, exact } = netForGross(207, 15);
  assert.equal(net, 180);
  assert.equal(exact, true);
  assert.equal(total(net, 15), 207);
});

test("zero tax leaves the price alone", () => {
  assert.deepEqual(netForGross(99.99, 0), { net: 99.99, exact: true });
});

test("a tax-included flat price always totals exactly what was typed, for every amount from $1.00 to $1000.00", () => {
  for (const rate of [15, 13, 5]) {
    for (let c = 100; c <= 100000; c++) {
      const gross = c / 100;
      const t = flatPriceTotals(gross, true, rate);
      assert.equal(t.total, gross.toFixed(2), `total for ${gross} @ ${rate}%`);
      // the tax shown is never more than a cent from the true figure
      const idealTax = gross - gross / (1 + rate / 100);
      assert.ok(Math.abs(Number(t.taxAmount) - idealTax) <= 0.011, `tax for ${gross} @ ${rate}%: ${t.taxAmount} vs ${idealTax}`);
      // and subtotal + tax is the total
      assert.equal((Number(t.subtotal) + Number(t.taxAmount)).toFixed(2), t.total, `sum for ${gross} @ ${rate}%`);
    }
  }
});

test("the owner's $207 splits as $180.00 + $27.00", () => {
  assert.deepEqual(flatPriceTotals(207, true, 15), { unitPrice: 180, subtotal: "180.00", taxAmount: "27.00", total: "207.00" });
});

test("a price with tax added on top is $180 + $27 = $207", () => {
  assert.deepEqual(flatPriceTotals(180, false, 15), { unitPrice: 180, subtotal: "180.00", taxAmount: "27.00", total: "207.00" });
});

test("most amounts have an exact whole-cent pre-tax price at 15%; the rest are absorbed into the tax line", () => {
  let exact = 0, n = 0;
  for (let c = 100; c <= 100000; c++) { n++; if (netForGross(c / 100, 15).exact) exact++; }
  assert.ok(exact / n > 0.85, `${exact}/${n}`);
});

test("works at other tax rates too (5% GST, 13% HST)", () => {
  for (const rate of [5, 13]) {
    for (const gross of [10, 49.5, 207, 380.65, 1036.15]) {
      const { net, exact } = netForGross(gross, rate);
      if (exact) assert.equal(total(net, rate), gross, `${gross} @ ${rate}%`);
    }
  }
});

test("a price entered without tax included is used as typed", () => {
  assert.deepEqual(unitPriceFor(180, false, 15), { unitPrice: 180, exact: true });
});

test("a price entered with tax included is split", () => {
  assert.deepEqual(unitPriceFor(207, true, 15), { unitPrice: 180, exact: true });
});

test("nonsense amounts do not throw", () => {
  assert.equal(netForGross(Number.NaN, 15).net, 0);
  assert.equal(netForGross(-5, 15).net, 0);
});
