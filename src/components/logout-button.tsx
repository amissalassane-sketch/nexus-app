"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    try {
      const client = supabase ?? createClient();
      await client.auth.signOut();
    } catch (cause) {
      console.error("Logout error:", cause);
    }

    // Clear the SSR cookies too, so Server Components stop seeing the user.
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);

    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex h-8 w-full items-center gap-2.5 rounded-nav px-2.5 text-[13px] text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
    >
      <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
      Log out
    </button>
  );
}
