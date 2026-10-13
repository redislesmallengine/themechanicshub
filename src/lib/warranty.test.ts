import { test } from "node:test";
import assert from "node:assert/strict";
import { claimStage, claimIsLate, daysSince, summarizeClaims } from "./warranty.ts";

// Run with:  node --test src/lib/warranty.test.ts
const DAY = 86400000;
const now = Date.parse("2026-10-14T12:00:00Z");
const daysAgo = (n: number) => new Date(now - n * DAY);

test("an invoice's status reads as a claim step", () => {
  assert.equal(claimStage("draft"), "notSubmitted");
  assert.equal(claimStage("sent"), "submitted");
  assert.equal(claimStage("viewed"), "submitted");
  assert.equal(claimStage("paid"), "paid");
  assert.equal(claimStage("void"), "void");
});

test("days since a date", () => {
  assert.equal(daysSince(daysAgo(12), now), 12);
  assert.equal(daysSince(null, now), null);
  assert.equal(daysSince(new Date(now + DAY), now), 0); // never negative
});

test("a submitted claim is late only once it passes 30 days", () => {
  assert.equal(claimIsLate("sent", daysAgo(29), now), false);
  assert.equal(claimIsLate("sent", daysAgo(30), now), true);
  assert.equal(claimIsLate("viewed", daysAgo(90), now), true);
});

test("claims that are paid, not submitted, or have no date are never late", () => {
  assert.equal(claimIsLate("paid", daysAgo(90), now), false);
  assert.equal(claimIsLate("draft", daysAgo(90), now), false);
  assert.equal(claimIsLate("sent", null, now), false);
});

test("summary counts and dollars by step, with void claims ignored", () => {
  const s = summarizeClaims(
    [
      { status: "draft", total: 100, sentAt: null },
      { status: "draft", total: 50, sentAt: null },
      { status: "sent", total: 129.38, sentAt: daysAgo(5) },
      { status: "sent", total: 200, sentAt: daysAgo(45) },
      { status: "paid", total: 80, sentAt: daysAgo(60) },
      { status: "void", total: 999, sentAt: null },
    ],
    now
  );
  assert.deepEqual(s.notSubmitted, { count: 2, amount: 150 });
  assert.equal(s.submitted.count, 2);
  assert.ok(Math.abs(s.submitted.amount - 329.38) < 0.001);
  assert.deepEqual(s.late, { count: 1, amount: 200 });
  assert.deepEqual(s.paid, { count: 1, amount: 80 });
});
