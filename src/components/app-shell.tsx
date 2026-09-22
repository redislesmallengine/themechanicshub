"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type ComponentType, type SVGProps } from "react";
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
  SearchIcon,
  EquipmentIcon,
  ReportIcon,
} from "@/components/icons";

const SIDEBAR_COLLAPSED_KEY = "mechanicshophub:sidebar-collapsed";

// A per-viewer preference read from localStorage, synced via
// useSyncExternalStore rather than "read it in an effect and setState" —
// that pattern causes an extra render pass (flagged by the
// react-hooks/set-state-in-effect rule) and, done wrong, a hydration
// mismatch (server has no localStorage). getServerSnapshot always returns
// false so server and first client paint agree; the real value (if
// different) applies on the next paint once the store's module-level cache
// is warmed from localStorage.
let cachedCollapsed: boolean | null = null;
const collapsedListeners = new Set<() => void>();

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false; // private browsing, blocked site data, etc. — just stays expanded
  }
}

function subscribeCollapsed(listener: () => void) {
  collapsedListeners.add(listener);
  return () => collapsedListeners.delete(listener);
}

function getCollapsedSnapshot(): boolean {
  if (cachedCollapsed === null) cachedCollapsed = readStoredCollapsed();
  return cachedCollapsed;
}

function getCollapsedServerSnapshot(): boolean {
  return false;
}

function setCollapsed(next: boolean) {
  cachedCollapsed = next;
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    // best-effort only — nothing to fall back to for persistence
  }
  collapsedListeners.forEach((listener) => listener());
}

// Icon color per item matches the reference design's pattern: every nav
// item carries its own distinct hue at rest (not just on hover/active), so
// the sidebar reads as a set of specific destinations rather than one flat
// grey list. Overridden to white when the item is the active route.
// Customers/Equipment/Inventory lead (the day-to-day lookup tools) with
// Work Orders after them, matching how a shop actually starts a visit —
// find the customer and their equipment before opening a ticket.
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, color: "text-blue-400" },
  { href: "/customers", label: "Customers", icon: CustomersIcon, color: "text-emerald-400" },
  { href: "/equipment", label: "Customer Equipment", icon: EquipmentIcon, color: "text-violet-400" },
  { href: "/inventory", label: "Inventory", icon: InventoryIcon, color: "text-indigo-400" },
  { href: "/work-orders", label: "Work Orders", icon: WorkOrderIcon, color: "text-amber-400" },
  { href: "/invoices", label: "Invoices", icon: InvoiceIcon, color: "text-sky-400" },
];

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  /** Set when a broader item's href would otherwise also match this one's prefix (e.g. "Email" vs "Email Templates"). */
  exact?: boolean;
}

function isNavItemActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

// The "Configuration" submenu — everything a shop owner sets up once and
// rarely touches again, tucked behind its own collapsible parent instead of
// competing with the daily-use items above for sidebar space.
// "Email" needs an exact match, not startsWith, or its highlight would also
// light up on /settings/email-templates.
const CONFIG_NAV: NavItem[] = [
  { href: "/settings/shop", label: "Shop Profile", icon: StoreIcon, color: "text-teal-400" },
  { href: "/settings/email", label: "Email", icon: SettingsIcon, color: "text-rose-400", exact: true },
  { href: "/settings/email-templates", label: "Email Templates", icon: SettingsIcon, color: "text-rose-400" },
  { href: "/settings/equipment-types", label: "Equipment Types", icon: EquipmentIcon, color: "text-violet-400" },
  { href: "/settings/equipment-makes", label: "Equipment Makes", icon: EquipmentIcon, color: "text-violet-400" },
  { href: "/settings/engine-types", label: "Engine Types", icon: EquipmentIcon, color: "text-violet-400" },
  { href: "/settings/part-categories", label: "Part Categories", icon: InventoryIcon, color: "text-indigo-400" },
];

// One entry today (a customer's full history — equipment, work orders,
// invoices, activity, all in one place) but its own top-level menu since
// more reports land here later, same as Configuration.
const REPORTS_NAV: NavItem[] = [{ href: "/reports/customer-360", label: "Customer 360", icon: CustomersIcon, color: "text-emerald-400" }];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function CollapseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="m14 10-2 2 2 2" />
    </svg>
  );
}

function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Header({ user, roleLabel, onMenuClick }: { user: { name: string; email: string }; roleLabel?: string; onMenuClick: () => void }) {
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

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q");
    if (typeof q === "string" && q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header
      className="h-16 px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 z-30"
      style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition md:hidden"
          style={{ color: "var(--text-secondary)" }}
          title="Open menu"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600">
          <WrenchIcon className="w-4.5 h-4.5 text-white" />
        </span>
        <span className="font-bold text-base tracking-tight hidden sm:inline" style={{ color: "var(--text-primary)" }}>
          Mechanic Shop Hub
        </span>
      </div>

      <form onSubmit={handleSearch} className="flex-1 max-w-sm hidden md:block">
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            name="q"
            type="text"
            placeholder="Search customers, equipment…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
          />
        </div>
      </form>

      <div className="flex items-center gap-3 shrink-0">
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

function NavLink({
  href,
  label,
  icon: Icon,
  color,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  // `collapsed` (the desktop icon-rail preference) only takes visual effect
  // at md+ — the mobile drawer always shows full icon+label regardless of
  // it, so every class that responds to `collapsed` carries an `md:`
  // prefix rather than applying unconditionally.
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-2.5 py-2 rounded-lg text-xs transition px-2.5 ${collapsed ? "md:justify-center md:px-2" : ""}`}
      style={active ? { background: "rgba(15,82,186,.9)", color: "#fff" } : { color: "#CBD5E1" }}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-white" : color}`} />
      {collapsed ? <span className="md:hidden">{label}</span> : label}
    </Link>
  );
}

function SectionLabel({ children, collapsed }: { children: ReactNode; collapsed: boolean }) {
  return (
    <div className={`px-2 text-[11px] font-semibold uppercase tracking-wider mb-1 font-mono ${collapsed ? "md:hidden" : ""}`} style={{ color: "#64748B" }}>
      {children}
    </div>
  );
}

/** A collapsible parent + submenu, e.g. Configuration or Reports — opens automatically on first load if a child route is already active, otherwise starts closed; stays as the user left it while they navigate elsewhere, since this component isn't remounted between pages. */
function NavGroup({
  label,
  icon: Icon,
  iconColor,
  items,
  collapsed,
  pathname,
  onNavigate,
}: {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconColor: string;
  items: NavItem[];
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = items.some((item) => isNavItemActive(item, pathname));
  const [open, setOpen] = useState(active);

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? label : undefined}
        aria-expanded={open}
        className={`w-full flex items-center gap-2.5 py-2 rounded-lg text-xs transition px-2.5 ${collapsed ? "md:justify-center md:px-2" : ""}`}
        style={active ? { background: "rgba(15,82,186,.9)", color: "#fff" } : { color: "#CBD5E1" }}
      >
        <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-white" : iconColor}`} />
        {collapsed ? <span className="md:hidden flex-1 text-left">{label}</span> : <span className="flex-1 text-left">{label}</span>}
        <ChevronDownIcon className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${collapsed ? "md:hidden" : ""}`} />
      </button>

      {open && (
        <nav className={`space-y-0.5 mt-0.5 pl-3.5 ml-4 border-l border-l-[#1E293B] ${collapsed ? "md:pl-0 md:ml-0 md:border-l-0" : ""}`}>
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              color={item.color}
              collapsed={collapsed}
              onNavigate={onNavigate}
              active={isNavItemActive(item, pathname)}
            />
          ))}
        </nav>
      )}
    </div>
  );
}

export function AppShell({
  user,
  roleLabel,
  canManageSettings,
  canViewReports,
  isSiteAdmin,
  children,
}: {
  user: { name: string; email: string };
  roleLabel?: string;
  canManageSettings?: boolean;
  canViewReports?: boolean;
  isSiteAdmin?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsedSnapshot, getCollapsedServerSnapshot);
  // Separate from `collapsed` (the desktop icon-rail preference, persisted)
  // — this is the mobile off-canvas drawer's open/closed state, always
  // starts closed, never persisted. Below the md breakpoint the sidebar is
  // fixed-position and hidden by default (see the `aside` className below);
  // this is what slides it into view.
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsed(!collapsed);
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header user={user} roleLabel={roleLabel} onMenuClick={() => setMobileOpen(true)} />

      <div className="flex flex-1 overflow-hidden relative">
        {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={closeMobileMenu} />}

        <aside
          className={`fixed md:static inset-y-0 left-0 md:inset-auto z-40 p-3 flex flex-col shrink-0 overflow-y-auto transform md:transform-none transition-transform md:transition-[width] duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 w-64 ${collapsed ? "md:w-16" : "md:w-64"}`}
          style={{ background: "#0F172A", borderRight: "1px solid #1E293B" }}
        >
          <SectionLabel collapsed={collapsed}>Operations</SectionLabel>
          <nav className="space-y-0.5 mb-4">
            {NAV.map(({ href, label, icon, color }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                color={color}
                collapsed={collapsed}
                onNavigate={closeMobileMenu}
                active={pathname === href || pathname.startsWith(href + "/")}
              />
            ))}
          </nav>

          <SectionLabel collapsed={collapsed}>Security &amp; Staff</SectionLabel>
          <nav className="space-y-0.5 mb-4">
            <NavLink href="/staff" label="Staff &amp; Roles" icon={StaffIcon} color="text-brand-400" collapsed={collapsed} onNavigate={closeMobileMenu} active={pathname.startsWith("/staff")} />
          </nav>

          {canViewReports && (
            <NavGroup label="Reports" icon={ReportIcon} iconColor="text-orange-400" items={REPORTS_NAV} collapsed={collapsed} pathname={pathname} onNavigate={closeMobileMenu} />
          )}

          {canManageSettings && (
            <NavGroup label="Configuration" icon={SettingsIcon} iconColor="text-teal-400" items={CONFIG_NAV} collapsed={collapsed} pathname={pathname} onNavigate={closeMobileMenu} />
          )}

          {isSiteAdmin && (
            <>
              <SectionLabel collapsed={collapsed}>Platform</SectionLabel>
              <nav className="space-y-0.5">
                <NavLink href="/admin/roles" label="Roles &amp; Rights" icon={ShieldIcon} color="text-violet-400" collapsed={collapsed} onNavigate={closeMobileMenu} active={pathname.startsWith("/admin")} />
              </nav>
            </>
          )}

          <div className="mt-auto pt-3 hidden md:block" style={{ borderTop: "1px solid #1E293B" }}>
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`flex items-center gap-2.5 py-2 rounded-lg text-xs w-full transition hover:bg-white/5 ${collapsed ? "justify-center px-2" : "px-2.5"}`}
              style={{ color: "#CBD5E1" }}
            >
              <CollapseIcon className={`w-3.5 h-3.5 shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`} />
              {!collapsed && "Collapse"}
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-x-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
