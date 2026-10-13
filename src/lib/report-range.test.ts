import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRange, localMidnight } from "./report-range.ts";

// Run with:  node --test src/lib/report-range.test.ts
const TZ = "America/Halifax"; // PEI: UTC-3 in summer (ADT), UTC-4 in winter (AST)

const iso = (d: Date) => d.toISOString();
const range = (period: Parameters<typeof resolveRange>[0], now: string, from?: string, to?: string) => {
  const r = resolveRange(period, from, to, TZ, Date.parse(now));
  if ("error" in r) throw new Error(r.error);
  return { start: iso(r.start), end: iso(r.end) };
};

test("a month starts at the shop's midnight, not UTC's", () => {
  assert.equal(iso(localMidnight(2026, 10, 1, TZ)), "2026-10-01T03:00:00.000Z"); // ADT
  assert.equal(iso(localMidnight(2026, 1, 1, TZ)), "2026-01-01T04:00:00.000Z"); // AST
});

test("this month and last month in October", () => {
  assert.deepEqual(range("this-month", "2026-10-14T12:00:00Z"), { start: "2026-10-01T03:00:00.000Z", end: "2026-11-01T03:00:00.000Z" });
  assert.deepEqual(range("last-month", "2026-10-14T12:00:00Z"), { start: "2026-09-01T03:00:00.000Z", end: "2026-10-01T03:00:00.000Z" });
});

test("11:30 pm on the last evening of the month is still that month for the shop", () => {
  // 2026-11-01T02:30Z is October 31, 23:30 in PEI
  assert.deepEqual(range("this-month", "2026-11-01T02:30:00Z"), { start: "2026-10-01T03:00:00.000Z", end: "2026-11-01T03:00:00.000Z" });
});

test("year to date runs from January 1 through the end of today", () => {
  assert.deepEqual(range("ytd", "2026-10-14T12:00:00Z"), { start: "2026-01-01T04:00:00.000Z", end: "2026-10-15T03:00:00.000Z" });
});

test("last year", () => {
  assert.deepEqual(range("last-year", "2026-10-14T12:00:00Z"), { start: "2025-01-01T04:00:00.000Z", end: "2026-01-01T04:00:00.000Z" });
});

test("January looks back to December of the previous year", () => {
  assert.deepEqual(range("last-month", "2026-01-10T12:00:00Z"), { start: "2025-12-01T04:00:00.000Z", end: "2026-01-01T04:00:00.000Z" });
});

test("a custom range includes the end date", () => {
  assert.deepEqual(range("custom", "2026-10-14T12:00:00Z", "2026-10-01", "2026-10-31"), { start: "2026-10-01T03:00:00.000Z", end: "2026-11-01T03:00:00.000Z" });
});

test("a custom range with missing or backwards dates is refused", () => {
  assert.ok("error" in resolveRange("custom", undefined, undefined, TZ, Date.now()));
  assert.ok("error" in resolveRange("custom", "2026-10-31", "2026-10-01", TZ, Date.now()));
});
