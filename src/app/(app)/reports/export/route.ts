import { headers } from "next/headers";
import type { DetailTable } from "@/lib/report-engine";
import { parseParams } from "@/lib/report-params";
import { reportAccess } from "@/lib/report-access";
import { runHst, runIncome, runSales } from "@/lib/report-run";

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function tableRows(t: DetailTable): (string | number)[][] {
  const out: (string | number)[][] = [t.cols.map((c) => c.h)];
  const fmt = (kind: DetailTable["cols"][number]["kind"], v: string | number | null) => (v === null ? "" : kind === "money" ? Number(v).toFixed(2) : kind === "pct" ? (Number(v) * 100).toFixed(1) : v);
  for (const r of t.rows) out.push(r.map((v, i) => fmt(t.cols[i].kind, v)));
  if (t.foot) out.push(t.foot.map((v, i) => fmt(t.cols[i].kind, v)));
  return out;
}

// Any of the three reports as a CSV file: a few lines saying what it covers, then every row behind the numbers.
// It reads the same address parameters as the page, so the file matches exactly what is on screen.
export async function GET(request: Request) {
  const access = await reportAccess(await headers());
  if (access.status === "signed-out") return new Response("Not signed in.", { status: 401 });
  if (access.status === "forbidden") return new Response("You don't have access to reports.", { status: 403 });

  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const p = parseParams(raw);
  const kind = raw.report === "sales" ? "sales" : raw.report === "hst" ? "hst" : "income";

  const head = (title: string, context: { range: { from: string; to: string } }, extra: (string | number)[][] = []) => [[title], ["From", context.range.from, "To", context.range.to], ...extra, []] as (string | number)[][];
  let lines: (string | number)[][];
  let span = "";
  if (kind === "income") {
    const { context, data } = await runIncome(access.organizationId, p, access.canViewMargins);
    span = `${context.range.from}-to-${context.range.to}`;
    lines = [...head("Income report", context, [["Money received", data.received.value.toFixed(2)], ["Payments", data.payments.value], ["Still owed (all dates)", data.owed.total.toFixed(2)]]), ...tableRows(data.details)];
  } else if (kind === "sales") {
    const { context, data } = await runSales(access.organizationId, p, access.canViewMargins);
    span = `${context.range.from}-to-${context.range.to}`;
    lines = [...head("Sales report", context, [["Sales before tax", data.sales.value.toFixed(2)], ["Invoices", data.invoices.value], ["Shown", p.detail === "line" ? "one row per invoice line" : "one row per invoice"]]), ...tableRows(data.details)];
  } else {
    const { context, data } = await runHst(access.organizationId, p, access.canViewMargins);
    span = `${context.range.from}-to-${context.range.to}`;
    lines = [
      ...head("HST report", context, [
        ["Basis", data.basis === "payment" ? "Payment date" : "Invoice date"],
        ["Line 101 Sales before tax", data.sales.toFixed(2)],
        ["Taxable sales", data.taxableSales.toFixed(2)],
        ["Not taxable", data.nonTaxableSales.toFixed(2)],
        ["Line 103 Tax collected", data.collected.value.toFixed(2)],
        ["Line 106 Input tax credits (estimate)", data.credits.toFixed(2)],
        ["Line 109 Net tax", data.net.toFixed(2)],
      ]),
      ...tableRows(data.details),
    ];
  }

  const csv = "﻿" + lines.map((row) => row.map(cell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-report-${span}.csv"`,
    },
  });
}
