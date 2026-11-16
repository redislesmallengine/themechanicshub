import { test } from "node:test";
import assert from "node:assert/strict";
import { formatWorkOrderNumber, parseWorkOrderSearch } from "./work-order-number.ts";

// Run with:  node --test src/lib/work-order-number.test.ts

test("a number is written WO-1042", () => {
  assert.equal(formatWorkOrderNumber(1042), "WO-1042");
  assert.equal(formatWorkOrderNumber(null), "");
  assert.equal(formatWorkOrderNumber(undefined), "");
});

test("1042, WO-1042, wo1042 and WO 1042 all search for work order 1042", () => {
  for (const t of ["1042", "WO-1042", "wo1042", "WO 1042", " wo-1042 ", "Wo - 1042"]) assert.equal(parseWorkOrderSearch(t), 1042, t);
});

test("names, phone numbers and part numbers are not work order numbers", () => {
  for (const t of ["", "judy", "902-394-2860", "BPR6ES", "WO-", "WO-abc", "10 42", "-5", "0", "99999999999"]) assert.equal(parseWorkOrderSearch(t), null, t);
});
