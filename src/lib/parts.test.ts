import { test } from "node:test";
import assert from "node:assert/strict";
import { partLineName } from "./parts.ts";

// Run with:  node --test src/lib/parts.test.ts

test("the part number is added after the name", () => {
  assert.equal(partLineName("Spark plug – NGK", "BKR6E"), "Spark plug – NGK (BKR6E)");
});

test("no part number leaves the name alone", () => {
  assert.equal(partLineName("Fuel line", null), "Fuel line");
  assert.equal(partLineName("Fuel line", undefined), "Fuel line");
  assert.equal(partLineName("Fuel line", "   "), "Fuel line");
});

test("a name that already holds the number is not doubled, whatever the case or dashes", () => {
  assert.equal(partLineName("NGK BKR6E spark plug", "BKR6E"), "NGK BKR6E spark plug");
  assert.equal(partLineName("NGK bkr-6e spark plug", "BKR6E"), "NGK bkr-6e spark plug");
  assert.equal(partLineName("Spark plug (BKR6E)", "bkr6e"), "Spark plug (BKR6E)");
});

test("a different number is still added", () => {
  assert.equal(partLineName("NGK BKR6E spark plug", "BPR7HS"), "NGK BKR6E spark plug (BPR7HS)");
});
