import { Suspense, type ComponentType } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkOrderIcon, InvoiceIcon, CustomersIcon, StaffIcon } from "@/components/icons";
import {
  ShopFloorTiles,
  OpenWorkOrdersSection,
  RevenueTiles,
  RevenueTrendCard,
  WorkOrdersByStatusCard,
  OpenedVsClosedCard,
  RevenueByTypeCard,
  TopCustomersCard,
  TopPartsCard,
  CustomerTiles,
  InventoryValueCard,
  TechnicianWorkloadCard,
  LowStockCard,
} from "@/components/dashboard/sections";
import { TileRowSkeleton, ChartSkeleton, ListSkeleton, TableSkeleton, Spinner } from "@/components/dashboard/skeletons";
import { GettingStartedChecklist } from "@/components/dashboard/getting-started-checklist";
import { getGettingStartedProgress } from "@/lib/dashboard";

const quickActionClass = "flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3.5 py-2 text-xs font-semibold shadow-sm transition";

function SectionHead({ icon: Icon, label, note }: { icon: ComponentType<{ className?: string }>; label: string; note?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
        <Icon className="w-4 h-4 text-brand-600" />
        {label}
      </div>
      {note && (
        <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
          {note}
        </span>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  if (!organizationId) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sign in to a shop to see its dashboard.
        </p>
      </div>
    );
  }

  // Two fast, single-row lookups the whole page needs -- not worth their
  // own Suspense boundary. Every genuinely expensive aggregate below is
  // deferred to its own section instead.
  const [organization, shopProfile, canViewRevenue, gettingStarted, canCreateCustomer, canCreateWorkOrder, canCreateInvoice] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.shopProfile.findUnique({ where: { organizationId }, select: { agingAlertDays: true, taxRate: true, labourRate: true, gettingStartedDismissed: true } }),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["viewMargins"] } } }).then((r) => r.success),
    getGettingStartedProgress(organizationId),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { customer: ["create"] } } }).then((r) => r.success),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { workOrder: ["create"] } } }).then((r) => r.success),
    auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["create"] } } }).then((r) => r.success),
  ]);
  const agingDays = shopProfile?.agingAlertDays ?? 14;

  const gettingStartedItems = [
    { label: "Set up your shop (tax rate, labor rate)", done: shopProfile?.taxRate != null && shopProfile?.labourRate != null, href: "/settings/shop", cta: "Set Up" },
    { label: "Add your first customer", done: gettingStarted.hasCustomer, href: "/customers/new", cta: "+ Add Customer" },
    { label: "Register their equipment", done: gettingStarted.hasEquipment, href: "/customers", cta: "+ Register Equipment" },
    { label: "Create a work order", done: gettingStarted.hasWorkOrder, href: "/work-orders/new", cta: "+ New Work Order" },
    { label: "Send your first invoice", done: gettingStarted.hasSentInvoice, href: "/invoices", cta: "View Invoices" },
  ];
  const showGettingStarted = !shopProfile?.gettingStartedDismissed && gettingStartedItems.some((i) => !i.done);

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Dashboard
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Today&apos;s shop-floor snapshot for {organization?.name ?? "your shop"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateCustomer && (
            <Link href="/customers/new" className={quickActionClass}>
              + New Customer
            </Link>
          )}
          {canCreateWorkOrder && (
            <Link href="/work-orders/new" className={quickActionClass}>
              + New Work Order
            </Link>
          )}
          {canCreateWorkOrder && (
            <Link href="/work-orders/quick" className={quickActionClass}>
              ⚡ Quick Job
            </Link>
          )}
          {canCreateInvoice && (
            <Link href="/invoices/new" className={quickActionClass}>
              + New Invoice
            </Link>
          )}
        </div>
      </div>

      {showGettingStarted && <GettingStartedChecklist items={gettingStartedItems} />}

      {/* SHOP FLOOR — visible to everyone */}
      <div>
        <SectionHead icon={WorkOrderIcon} label="Shop Floor" note="VISIBLE TO ALL STAFF" />
        <Suspense fallback={<TileRowSkeleton count={4} />}>
          <ShopFloorTiles organizationId={organizationId} agingDays={agingDays} />
        </Suspense>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
            Open Work Orders
          </h2>
        </div>
        <Suspense fallback={<TableSkeleton />}>
          <OpenWorkOrdersSection organizationId={organizationId} agingDays={agingDays} />
        </Suspense>
      </div>

      {/* REVENUE — Owner/Manager only; queries never run at all for anyone else */}
      {canViewRevenue && (
        <>
          <div>
            <SectionHead icon={InvoiceIcon} label="Revenue" note="OWNER / MANAGER VIEW" />
            <Suspense fallback={<TileRowSkeleton count={6} />}>
              <RevenueTiles organizationId={organizationId} />
            </Suspense>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3.5">
            <Suspense fallback={<ChartSkeleton />}>
              <RevenueTrendCard organizationId={organizationId} />
            </Suspense>
            <Suspense fallback={<ChartSkeleton />}>
              <WorkOrdersByStatusCard organizationId={organizationId} />
            </Suspense>
          </div>
        </>
      )}

      {!canViewRevenue && (
        <div className="grid grid-cols-1 gap-3.5">
          <Suspense fallback={<ChartSkeleton />}>
            <WorkOrdersByStatusCard organizationId={organizationId} />
          </Suspense>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <Suspense fallback={<ChartSkeleton />}>
          <OpenedVsClosedCard organizationId={organizationId} />
        </Suspense>
        {canViewRevenue && (
          <Suspense fallback={<ChartSkeleton />}>
            <RevenueByTypeCard organizationId={organizationId} />
          </Suspense>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {canViewRevenue && (
          <Suspense fallback={<ListSkeleton />}>
            <TopCustomersCard organizationId={organizationId} />
          </Suspense>
        )}
        <Suspense fallback={<ListSkeleton />}>
          <TopPartsCard organizationId={organizationId} />
        </Suspense>
      </div>

      {/* CUSTOMERS */}
      <div>
        <SectionHead icon={CustomersIcon} label="Customers" />
        <Suspense fallback={<TileRowSkeleton count={3} />}>
          <CustomerTiles organizationId={organizationId} />
        </Suspense>
      </div>

      {/* STAFF & INVENTORY */}
      <div>
        <SectionHead icon={StaffIcon} label="Staff & Inventory" />
        <div className="space-y-3.5">
          {canViewRevenue && (
            <Suspense
              fallback={
                <div className="rounded-xl p-4 flex items-center gap-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                  <Spinner />
                  <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    Loading…
                  </span>
                </div>
              }
            >
              <InventoryValueCard organizationId={organizationId} />
            </Suspense>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Suspense fallback={<ListSkeleton />}>
              <TechnicianWorkloadCard organizationId={organizationId} />
            </Suspense>
            <Suspense fallback={<ListSkeleton />}>
              <LowStockCard organizationId={organizationId} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
