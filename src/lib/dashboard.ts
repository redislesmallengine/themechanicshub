import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { BOARD_STATUSES } from "@/lib/work-orders";

/**
 * Every dashboard number as its own small, targeted query -- never "fetch
 * every row and reduce in JS." Counts/sums are computed in Postgres with
 * FILTER/GROUP BY, batched per section so each Suspense boundary in the
 * page (src/app/(app)/dashboard/page.tsx) triggers exactly one of these
 * instead of a chain of round trips. Every query is organizationId-scoped
 * and, where the stat is inherently a recent window (this month, last 30
 * days, last 6 weeks), date-filtered too -- the exceptions (top customers,
 * repeat-customer rate) are inherently lifetime numbers, not an oversight.
 */

export interface ShopFloorCounts {
  onBench: number;
  awaitingApproval: number;
  awaitingApproval2Days: number;
  repairCompleted: number;
  repairCompletedAging: number;
  unpaidTotal: number;
  unpaidCount: number;
}

export async function getShopFloorCounts(organizationId: string, agingDays: number): Promise<ShopFloorCounts> {
  const [woRows, invRows] = await Promise.all([
    prisma.$queryRaw<{ on_bench: bigint; awaiting_approval: bigint; awaiting_2d: bigint; repair_completed: bigint; repair_completed_aging: bigint }[]>(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE status IN ('diagnosing','inRepair')) AS on_bench,
        count(*) FILTER (WHERE status = 'awaitingApproval') AS awaiting_approval,
        count(*) FILTER (WHERE status = 'awaitingApproval' AND "awaitingApprovalAt" <= now() - interval '2 days') AS awaiting_2d,
        count(*) FILTER (WHERE status = 'readyForPickup') AS repair_completed,
        count(*) FILTER (WHERE status = 'readyForPickup' AND "readyForPickupAt" <= now() - (${agingDays}::text || ' days')::interval) AS repair_completed_aging
      FROM "WorkOrder"
      WHERE "organizationId" = ${organizationId} AND status NOT IN ('closed', 'declined')
    `),
    prisma.$queryRaw<{ total: string | null; cnt: bigint }[]>(Prisma.sql`
      SELECT COALESCE(SUM(total), 0)::text AS total, count(*) AS cnt
      FROM "Invoice"
      WHERE "organizationId" = ${organizationId} AND status IN ('sent', 'viewed')
    `),
  ]);
  const wo = woRows[0];
  const inv = invRows[0];
  return {
    onBench: Number(wo?.on_bench ?? 0),
    awaitingApproval: Number(wo?.awaiting_approval ?? 0),
    awaitingApproval2Days: Number(wo?.awaiting_2d ?? 0),
    repairCompleted: Number(wo?.repair_completed ?? 0),
    repairCompletedAging: Number(wo?.repair_completed_aging ?? 0),
    unpaidTotal: Number(inv?.total ?? 0),
    unpaidCount: Number(inv?.cnt ?? 0),
  };
}

/** The same 15 rows the old dashboard fetched via findMany, but now separate from the tile counts above -- a busy shop with 50 open work orders no longer means the tile numbers wait on 50 rows' worth of customer/equipment joins. */
export async function getOpenWorkOrders(organizationId: string, limit = 15) {
  return prisma.workOrder.findMany({
    where: { organizationId, status: { notIn: ["closed", "declined"] } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: { customer: true, equipment: { include: { equipmentType: true } } },
  });
}

export async function getOpenWorkOrderCount(organizationId: string): Promise<number> {
  return prisma.workOrder.count({ where: { organizationId, status: { notIn: ["closed", "declined"] } } });
}

export interface RevenueTiles {
  revenueThisMonth: number;
  revenueLastMonth: number;
  outstanding: number;
  overdue: number;
  overdueCount: number;
  avgInvoice30d: number;
  partsMarginPercent: number | null;
}

export async function getRevenueTiles(organizationId: string): Promise<RevenueTiles> {
  const [monthRows, outstandingRows, avgRows, marginRows] = await Promise.all([
    prisma.$queryRaw<{ this_month: string | null; last_month: string | null }[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(total) FILTER (WHERE "paidAt" >= date_trunc('month', now())), 0)::text AS this_month,
        COALESCE(SUM(total) FILTER (WHERE "paidAt" >= date_trunc('month', now() - interval '1 month') AND "paidAt" < date_trunc('month', now())), 0)::text AS last_month
      FROM "Invoice"
      WHERE "organizationId" = ${organizationId} AND status = 'paid'
    `),
    prisma.$queryRaw<{ outstanding: string | null; overdue: string | null; overdue_count: bigint }[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(total) FILTER (WHERE "dueDate" >= now()), 0)::text AS outstanding,
        COALESCE(SUM(total) FILTER (WHERE "dueDate" < now()), 0)::text AS overdue,
        count(*) FILTER (WHERE "dueDate" < now()) AS overdue_count
      FROM "Invoice"
      WHERE "organizationId" = ${organizationId} AND status IN ('sent', 'viewed')
    `),
    prisma.$queryRaw<{ avg: string | null }[]>(Prisma.sql`
      SELECT COALESCE(AVG(total), 0)::text AS avg
      FROM "Invoice"
      WHERE "organizationId" = ${organizationId} AND status = 'paid' AND "paidAt" >= now() - interval '30 days'
    `),
    prisma.$queryRaw<{ revenue: string | null; cost: string | null }[]>(Prisma.sql`
      SELECT COALESCE(SUM(li."lineTotal"), 0)::text AS revenue, COALESCE(SUM(li.quantity * li."unitCost"), 0)::text AS cost
      FROM "InvoiceLineItem" li
      JOIN "Invoice" i ON i.id = li."invoiceId"
      WHERE i."organizationId" = ${organizationId} AND i.status = 'paid' AND i."paidAt" >= date_trunc('month', now()) AND li.type = 'part'
    `),
  ]);

  const revenue = Number(marginRows[0]?.revenue ?? 0);
  const cost = Number(marginRows[0]?.cost ?? 0);

  return {
    revenueThisMonth: Number(monthRows[0]?.this_month ?? 0),
    revenueLastMonth: Number(monthRows[0]?.last_month ?? 0),
    outstanding: Number(outstandingRows[0]?.outstanding ?? 0),
    overdue: Number(outstandingRows[0]?.overdue ?? 0),
    overdueCount: Number(outstandingRows[0]?.overdue_count ?? 0),
    avgInvoice30d: Number(avgRows[0]?.avg ?? 0),
    partsMarginPercent: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
  };
}

export interface RevenuePoint {
  date: string;
  total: number;
}

/** One point per day, last 30 days including today, zero-filled via generate_series so a slow day shows as a real dip rather than a missing point. */
export async function getRevenueTrend(organizationId: string): Promise<RevenuePoint[]> {
  const rows = await prisma.$queryRaw<{ day: Date; total: string }[]>(Prisma.sql`
    SELECT d::date AS day, COALESCE(SUM(i.total), 0)::text AS total
    FROM generate_series(current_date - interval '29 days', current_date, interval '1 day') AS d
    LEFT JOIN "Invoice" i ON i."organizationId" = ${organizationId} AND i.status = 'paid' AND date_trunc('day', i."paidAt") = d
    GROUP BY d
    ORDER BY d
  `);
  return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), total: Number(r.total) }));
}

export interface StatusCount {
  status: string;
  count: number;
}

/** Board statuses only (matches the Work Orders board) -- closed/declined are excluded on purpose, or this would grow unbounded as history accumulates. */
export async function getWorkOrdersByStatus(organizationId: string): Promise<StatusCount[]> {
  const rows = await prisma.$queryRaw<{ status: string; cnt: bigint }[]>(Prisma.sql`
    SELECT status, count(*) AS cnt
    FROM "WorkOrder"
    WHERE "organizationId" = ${organizationId} AND status IN (${Prisma.join(BOARD_STATUSES)})
    GROUP BY status
  `);
  const counts = new Map(rows.map((r) => [r.status, Number(r.cnt)]));
  return BOARD_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

export interface WeeklyThroughput {
  weekStart: string;
  opened: number;
  closed: number;
}

export async function getOpenedVsClosed(organizationId: string): Promise<WeeklyThroughput[]> {
  const rows = await prisma.$queryRaw<{ week_start: Date; opened: bigint; closed: bigint }[]>(Prisma.sql`
    WITH weeks AS (
      SELECT date_trunc('week', current_date - (n || ' weeks')::interval)::date AS week_start
      FROM generate_series(0, 5) AS n
    )
    SELECT
      w.week_start,
      (SELECT count(*) FROM "WorkOrder" wo WHERE wo."organizationId" = ${organizationId} AND date_trunc('week', wo."createdAt") = w.week_start) AS opened,
      (SELECT count(*) FROM "WorkOrder" wo WHERE wo."organizationId" = ${organizationId} AND wo."closedAt" IS NOT NULL AND date_trunc('week', wo."closedAt") = w.week_start) AS closed
    FROM weeks w
    ORDER BY w.week_start
  `);
  return rows.map((r) => ({ weekStart: r.week_start.toISOString().slice(0, 10), opened: Number(r.opened), closed: Number(r.closed) }));
}

export interface TypeRevenue {
  invoiceType: string;
  total: number;
}

export async function getRevenueByType(organizationId: string): Promise<TypeRevenue[]> {
  const rows = await prisma.$queryRaw<{ invoice_type: string; total: string }[]>(Prisma.sql`
    SELECT "invoiceType" AS invoice_type, SUM(total)::text AS total
    FROM "Invoice"
    WHERE "organizationId" = ${organizationId} AND status = 'paid' AND "paidAt" >= date_trunc('month', now())
    GROUP BY "invoiceType"
  `);
  return rows.map((r) => ({ invoiceType: r.invoice_type, total: Number(r.total) }));
}

export interface TopCustomer {
  id: string;
  name: string;
  total: number;
}

/** All-time, deliberately -- "who are my best customers" is a lifetime question, not a this-month one. */
export async function getTopCustomers(organizationId: string, limit = 5): Promise<TopCustomer[]> {
  const rows = await prisma.$queryRaw<{ id: string; name: string; total: string }[]>(Prisma.sql`
    SELECT c.id, c.name, SUM(i.total)::text AS total
    FROM "Invoice" i
    JOIN "Customer" c ON c.id = i."customerId"
    WHERE i."organizationId" = ${organizationId} AND i.status = 'paid'
    GROUP BY c.id, c.name
    ORDER BY SUM(i.total) DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ id: r.id, name: r.name, total: Number(r.total) }));
}

export interface TopPart {
  id: string;
  name: string;
  quantity: number;
}

/**
 * "Sold" means actually left the shelf for a customer -- combines parts
 * rung up directly on an invoice (InvoiceLineItem.partId) with parts used
 * on a work order (WorkOrderPart.partId), since a part copied from a work
 * order onto its invoice doesn't carry its own partId (see
 * generateInvoiceFromWorkOrder) and would otherwise be invisible here.
 */
export async function getTopParts(organizationId: string, limit = 5): Promise<TopPart[]> {
  const rows = await prisma.$queryRaw<{ id: string; name: string; qty: string }[]>(Prisma.sql`
    WITH combined AS (
      SELECT wp."partId" AS part_id, wp.quantity AS qty
      FROM "WorkOrderPart" wp
      JOIN "WorkOrder" wo ON wo.id = wp."workOrderId"
      WHERE wo."organizationId" = ${organizationId} AND wp."partId" IS NOT NULL AND wp."createdAt" >= date_trunc('month', now())
      UNION ALL
      SELECT li."partId" AS part_id, li.quantity::int AS qty
      FROM "InvoiceLineItem" li
      JOIN "Invoice" i ON i.id = li."invoiceId"
      WHERE i."organizationId" = ${organizationId} AND li."partId" IS NOT NULL AND li."createdAt" >= date_trunc('month', now())
    )
    SELECT p.id, p.name, SUM(combined.qty)::text AS qty
    FROM combined
    JOIN "Part" p ON p.id = combined.part_id
    GROUP BY p.id, p.name
    ORDER BY SUM(combined.qty) DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ id: r.id, name: r.name, quantity: Number(r.qty) }));
}

export interface TechWorkload {
  userId: string;
  name: string;
  active: number;
  completedThisMonth: number;
}

export async function getTechnicianWorkload(organizationId: string, limit = 6): Promise<TechWorkload[]> {
  const rows = await prisma.$queryRaw<{ id: string; name: string; active: bigint; completed: bigint }[]>(Prisma.sql`
    SELECT u.id, u.name,
      count(*) FILTER (WHERE wo.status NOT IN ('closed', 'declined')) AS active,
      count(*) FILTER (WHERE wo.status = 'closed' AND wo."closedAt" >= date_trunc('month', now())) AS completed
    FROM "WorkOrder" wo
    JOIN "User" u ON u.id = wo."assignedToUserId"
    WHERE wo."organizationId" = ${organizationId} AND wo."assignedToUserId" IS NOT NULL
    GROUP BY u.id, u.name
    HAVING count(*) FILTER (WHERE wo.status NOT IN ('closed', 'declined')) > 0
        OR count(*) FILTER (WHERE wo.status = 'closed' AND wo."closedAt" >= date_trunc('month', now())) > 0
    ORDER BY active DESC, completed DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ userId: r.id, name: r.name, active: Number(r.active), completedThisMonth: Number(r.completed) }));
}

export interface LowStockPart {
  id: string;
  name: string;
  quantityOnHand: number;
  reorderPoint: number;
}

export async function getLowStockParts(organizationId: string, limit = 5): Promise<LowStockPart[]> {
  return prisma.$queryRaw<LowStockPart[]>(Prisma.sql`
    SELECT id, name, "quantityOnHand"::int AS "quantityOnHand", "reorderPoint"::int AS "reorderPoint"
    FROM "Part"
    WHERE "organizationId" = ${organizationId} AND "quantityOnHand" <= "reorderPoint"
    ORDER BY ("quantityOnHand" - "reorderPoint") ASC
    LIMIT ${limit}
  `);
}

export interface InventoryValue {
  totalValue: number;
  partCount: number;
}

export async function getInventoryValue(organizationId: string): Promise<InventoryValue> {
  const rows = await prisma.$queryRaw<{ value: string | null; cnt: bigint }[]>(Prisma.sql`
    SELECT COALESCE(SUM("quantityOnHand" * COALESCE("costPrice", 0)), 0)::text AS value, count(*) AS cnt
    FROM "Part"
    WHERE "organizationId" = ${organizationId}
  `);
  return { totalValue: Number(rows[0]?.value ?? 0), partCount: Number(rows[0]?.cnt ?? 0) };
}

export interface CustomerStats {
  newThisMonth: number;
  newLastMonth: number;
  repeatRatePercent: number;
  owingCount: number;
  owingTotal: number;
}

export async function getCustomerStats(organizationId: string): Promise<CustomerStats> {
  const [newRows, repeatRows, owingRows] = await Promise.all([
    prisma.$queryRaw<{ this_month: bigint; last_month: bigint }[]>(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE "createdAt" >= date_trunc('month', now())) AS this_month,
        count(*) FILTER (WHERE "createdAt" >= date_trunc('month', now() - interval '1 month') AND "createdAt" < date_trunc('month', now())) AS last_month
      FROM "Customer"
      WHERE "organizationId" = ${organizationId}
    `),
    prisma.$queryRaw<{ repeat_pct: string | null }[]>(Prisma.sql`
      SELECT ROUND(100.0 * count(*) FILTER (WHERE wo_count >= 2) / NULLIF(count(*), 0), 1)::text AS repeat_pct
      FROM (
        SELECT "customerId", count(*) AS wo_count
        FROM "WorkOrder"
        WHERE "organizationId" = ${organizationId}
        GROUP BY "customerId"
      ) sub
    `),
    prisma.$queryRaw<{ cnt: bigint; total: string | null }[]>(Prisma.sql`
      SELECT count(DISTINCT "customerId") AS cnt, COALESCE(SUM(total), 0)::text AS total
      FROM "Invoice"
      WHERE "organizationId" = ${organizationId} AND status IN ('sent', 'viewed')
    `),
  ]);
  return {
    newThisMonth: Number(newRows[0]?.this_month ?? 0),
    newLastMonth: Number(newRows[0]?.last_month ?? 0),
    repeatRatePercent: Number(repeatRows[0]?.repeat_pct ?? 0),
    owingCount: Number(owingRows[0]?.cnt ?? 0),
    owingTotal: Number(owingRows[0]?.total ?? 0),
  };
}
