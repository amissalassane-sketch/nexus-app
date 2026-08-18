"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error.message);
      return;
    }

    router.push("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="w-full rounded-md bg-bg-surface px-3 py-2 text-left text-sm text-text-secondary transition hover:bg-bg-surface-2 hover:text-text-primary"
    >
      Log out
    </button>
  );
}
