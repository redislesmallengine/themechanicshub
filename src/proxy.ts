import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Fast-path only: redirects an obviously-signed-out browser away from
// protected pages before a render even starts. This is NOT the real
// authorization check — that happens again in src/app/(app)/layout.tsx,
// per Next.js's own guidance that Proxy coverage can silently drop after a
// route refactor and must never be the sole guard.
const PROTECTED_PREFIXES = ["/dashboard", "/work-orders", "/customers", "/inventory", "/invoices", "/staff"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
