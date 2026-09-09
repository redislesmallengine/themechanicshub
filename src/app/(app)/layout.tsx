import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

// Real enforcement lives here, in the Server Component — not in proxy.ts.
// Per Next.js's own guidance (node_modules/next/dist/docs .../proxy.md):
// a Proxy matcher can silently stop covering a route after a refactor, so
// authentication must be checked again at the point that actually renders
// or mutates data, not just at the edge.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/sign-in");
  }

  return <AppShell user={session.user}>{children}</AppShell>;
}
