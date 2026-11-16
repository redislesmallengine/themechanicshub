import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "./money.ts";

// Run with:  node --test src/lib/money.test.ts

test("money always has two decimals", () => {
  assert.equal(money("129"), "129.00");
  assert.equal(money(623.3), "623.30");
  assert.equal(money("81.30"), "81.30");
  assert.equal(money(0), "0.00");
});

test("money copes with a missing or odd value", () => {
  assert.equal(money(null), "0.00");
  assert.equal(money(undefined), "0.00");
  assert.equal(money("abc"), "0.00");
});
