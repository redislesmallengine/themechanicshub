import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Fast-path only: redirects an obviously-signed-out browser away from
// protected pages before a render even starts. This is NOT the real
// authorization check — that happens again in src/app/(app)/layout.tsx,
// per Next.js's own guidance that Proxy coverage can silently drop after a
// route refactor and must never be the sole guard.
const PROTECTED_PREFIXES = ["/dashboard", "/work-orders", "/customers", "/inventory", "/invoices", "/staff"];

// mechanicsrepairhub.com and app.mechanicsrepairhub.com are bound to the
// same Coolify app/deploy — this is what tells them apart. The root domain
// now hosts the sales page instead of the app.
const MARKETING_HOSTS = new Set(["mechanicsrepairhub.com", "www.mechanicsrepairhub.com"]);

// Every invoice/estimate email sent before the app moved to
// app.mechanicsrepairhub.com still links to the root domain — redirect
// those specific paths there instead of 404ing on the sales page.
const CUSTOMER_LINK_PREFIXES = ["/invoice", "/estimate"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host")?.split(":")[0] ?? "";

  if (MARKETING_HOSTS.has(host)) {
    if (CUSTOMER_LINK_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.redirect(new URL(`https://app.mechanicsrepairhub.com${pathname}${search}`, request.url), 308);
    }
    if (!pathname.startsWith("/marketing-home")) {
      return NextResponse.rewrite(new URL("/marketing-home", request.url));
    }
    return NextResponse.next();
  }

  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
