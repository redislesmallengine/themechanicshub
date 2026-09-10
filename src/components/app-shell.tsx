"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  SettingsIcon,
  ShieldIcon,
  StoreIcon,
} from "@/components/icons";

// Icon color per item matches the reference design's pattern: every nav
// item carries its own distinct hue at rest (not just on hover/active), so
// the sidebar reads as a set of specific destinations rather than one flat
// grey list. Overridden to white when the item is the active route.
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, color: "text-blue-400" },
  { href: "/work-orders", label: "Work Orders", icon: WorkOrderIcon, color: "text-amber-400" },
  { href: "/customers", label: "Customers", icon: CustomersIcon, color: "text-emerald-400" },
  { href: "/inventory", label: "Inventory", icon: InventoryIcon, color: "text-indigo-400" },
  { href: "/invoices", label: "Invoices", icon: InvoiceIcon, color: "text-sky-400" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Header({ user, roleLabel }: { user: { name: string; email: string }; roleLabel?: string }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header
      className="h-16 px-4 md:px-6 flex items-center justify-between shrink-0 z-30"
      style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600">
          <WrenchIcon className="w-4.5 h-4.5 text-white" />
        </span>
        <span className="font-bold text-base tracking-tight hidden sm:inline" style={{ color: "var(--text-primary)" }}>
          Mechanic Shop Hub
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="relative p-2 rounded-lg hover:bg-slate-100 transition"
          style={{ color: "var(--text-secondary)" }}
          title="Notifications"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
        <div className="h-6 w-px hidden sm:block" style={{ background: "var(--border-subtle)" }} />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 pl-1 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-semibold text-xs flex items-center justify-center">
              {initials(user.name) || "?"}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                {user.name}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {roleLabel ?? user.email}
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 hidden lg:block" style={{ color: "var(--text-muted)" }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-44 rounded-lg py-1 z-40"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
            >
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                style={{ color: "var(--color-error-solid)" }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppShell({
  user,
  roleLabel,
  canManageSettings,
  isSiteAdmin,
  children,
}: {
  user: { name: string; email: string };
  roleLabel?: string;
  canManageSettings?: boolean;
  isSiteAdmin?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen">
      <Header user={user} roleLabel={roleLabel} />

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 p-3 flex flex-col shrink-0" style={{ background: "#0F172A", borderRight: "1px solid #1E293B" }}>
          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider mb-1 font-mono" style={{ color: "#64748B" }}>
            Operations
          </div>
          <nav className="space-y-0.5 mb-4">
            {NAV.map(({ href, label, icon: Icon, color }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition"
                  style={active ? { background: "rgba(15,82,186,.9)", color: "#fff" } : { color: "#CBD5E1" }}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? "text-white" : color}`} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider mb-1 font-mono" style={{ color: "#64748B" }}>
            Security &amp; Staff
          </div>
          <nav className="space-y-0.5 mb-4">
            <Link
              href="/staff"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition"
              style={pathname.startsWith("/staff") ? { background: "rgba(15,82,186,.9)", color: "#fff" } : { color: "#CBD5E1" }}
            >
              <StaffIcon className={`w-3.5 h-3.5 ${pathname.startsWith("/staff") ? "text-white" : "text-brand-400"}`} />
              Staff &amp; Roles
            </Link>
          </nav>

          {canManageSettings && (
            <>
              <div className="px-2 text-[11px] font-semibold uppercase tracking-wider mb-1 font-mono" style={{ color: "#64748B" }}>
                Shop
              </div>
              <nav className="space-y-0.5 mb-4">
                <Link
                  href="/settings/shop"
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition"
                  style={pathname.startsWith("/settings/shop") ? { background: "rgba(15,82,186,.9)", color: "#fff" } : { color: "#CBD5E1" }}
                >
                  <StoreIcon className={`w-3.5 h-3.5 ${pathname.startsWith("/settings/shop") ? "text-white" : "text-teal-400"}`} />
                  Shop Profile
                </Link>
                <Link
                  href="/settings/email"
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition"
                  style={pathname.startsWith("/settings/email") ? { background: "rgba(15,82,186,.9)", color: "#fff" } : { color: "#CBD5E1" }}
                >
                  <SettingsIcon className={`w-3.5 h-3.5 ${pathname.startsWith("/settings/email") ? "text-white" : "text-rose-400"}`} />
                  Email
                </Link>
              </nav>
            </>
          )}

          {isSiteAdmin && (
            <>
              <div className="px-2 text-[11px] font-semibold uppercase tracking-wider mb-1 font-mono" style={{ color: "#64748B" }}>
                Platform
              </div>
              <nav className="space-y-0.5 flex-1">
                <Link
                  href="/admin/roles"
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition"
                  style={pathname.startsWith("/admin") ? { background: "rgba(15,82,186,.9)", color: "#fff" } : { color: "#CBD5E1" }}
                >
                  <ShieldIcon className={`w-3.5 h-3.5 ${pathname.startsWith("/admin") ? "text-white" : "text-violet-400"}`} />
                  Roles &amp; Rights
                </Link>
              </nav>
            </>
          )}
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-x-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
