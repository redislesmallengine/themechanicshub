import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { ac, STATIC_ROLES } from "@/lib/permissions";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  // Dynamic (site-admin-managed) roles aren't known to the client — the
  // server resolves them at request time (dynamicAccessControl in
  // src/lib/auth.ts). This `roles` map only needs the one static role.
  plugins: [organizationClient({ ac, roles: STATIC_ROLES })],
});

export const { useSession, signIn, signOut } = authClient;
