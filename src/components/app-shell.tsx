"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  WrenchIcon,
  DashboardIcon,
  WorkOrderIcon,
  CustomersIcon,
  InventoryIcon,
  InvoiceIcon,
  StaffIcon,
  SearchIcon,
} from "@/components/icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/work-orders", label: "Work Orders", icon: WorkOrderIcon },
  { href: "/customers", label: "Customers", icon: CustomersIcon },
  { href: "/inventory", label: "Inventory", icon: InventoryIcon },
  { href: "/invoices", label: "Invoices", icon: InvoiceIcon },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="grid md:grid-cols-[240px_1fr] min-h-screen">
      <aside className="p-3 flex flex-col" style={{ background: "#0F172A", borderRight: "1px solid #1E293B" }}>
        <div className="flex items-center gap-2 px-2 py-2 mb-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-brand-600">
            <WrenchIcon className="w-4 h-4 text-white" />
          </span>
          <span className="text-white font-extrabold text-xs tracking-tight">SHOP HUB</span>
        </div>

        <div className="px-2 text-[10px] font-semibold uppercase tracking-wider mb-1 font-mono" style={{ color: "#64748B" }}>
          Operations
        </div>
        <nav className="space-y-0.5 mb-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-bold transition"
                style={
                  active
                    ? { background: "rgba(15,82,186,.9)", color: "#fff" }
                    : { color: "#CBD5E1" }
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-2 text-[10px] font-semibold uppercase tracking-wider mb-1 font-mono" style={{ color: "#64748B" }}>
          Security &amp; Staff
        </div>
        <nav className="space-y-0.5 flex-1">
          <Link
            href="/staff"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition"
            style={
              pathname.startsWith("/staff")
                ? { background: "rgba(15,82,186,.9)", color: "#fff" }
                : { color: "#CBD5E1" }
            }
          >
            <StaffIcon className="w-4 h-4" />
            Staff &amp; Roles
          </Link>
        </nav>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-2 py-2.5 mt-2 rounded-lg text-left"
          style={{ borderTop: "1px solid #1E293B" }}
        >
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-white font-extrabold text-[11px] bg-brand-600">
            {initials || "?"}
          </span>
          <div className="leading-tight">
            <div className="text-xs font-bold text-white">{user.name}</div>
            <div className="text-[11px]" style={{ color: "#64748B" }}>
              Sign out
            </div>
          </div>
        </button>
      </aside>

      <div className="flex flex-col min-w-0">
        <div
          className="flex items-center justify-between gap-4 px-6 py-3.5"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div
            className="flex-1 max-w-[340px] flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
          >
            <SearchIcon className="w-4 h-4" />
            Search customer, WO#, plate…
          </div>
        </div>
        <div className="flex-1 overflow-x-auto">{children}</div>
      </div>
    </div>
  );
}
