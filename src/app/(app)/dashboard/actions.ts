"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOpenWorkOrders, getOpenWorkOrderCount } from "@/lib/dashboard";

export interface OpenWorkOrderRow {
  id: string;
  status: string;
  updatedAt: string;
  readyForPickupAt: string | null;
  customerName: string;
  customerContact: string;
  equipmentLabel: string;
}

/**
 * Backs client-side pagination on the Open Work Orders table specifically
 * so paging/resizing it never re-navigates the whole /dashboard route --
 * that would re-run every other section's query too, and flash every other
 * section's skeleton, just to change this one table. organizationId always
 * comes from the session here, never a client-supplied value.
 */
export async function fetchOpenWorkOrdersPage(page: number, pageSize: number): Promise<{ workOrders: OpenWorkOrderRow[]; total: number }> {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;
  if (!organizationId) return { workOrders: [], total: 0 };

  const safePage = Math.max(1, Math.floor(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 5));

  const [workOrders, total] = await Promise.all([
    getOpenWorkOrders(organizationId, safePageSize, (safePage - 1) * safePageSize),
    getOpenWorkOrderCount(organizationId),
  ]);

  return {
    total,
    workOrders: workOrders.map((wo) => ({
      id: wo.id,
      status: wo.status,
      updatedAt: wo.updatedAt.toISOString(),
      readyForPickupAt: wo.readyForPickupAt ? wo.readyForPickupAt.toISOString() : null,
      customerName: wo.customer.name,
      customerContact: wo.customer.phone ?? wo.customer.email ?? "",
      equipmentLabel: [wo.equipment.make, wo.equipment.model].filter(Boolean).join(" / ") || wo.equipment.equipmentType?.name || "Equipment",
    })),
  };
}
