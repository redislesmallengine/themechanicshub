"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function handleClick() {
    setWorking(true);
    await authClient.signOut().catch(() => null);
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleClick} disabled={working} className="px-5 py-2 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
      {working ? "Signing out…" : "Sign out"}
    </button>
  );
}
