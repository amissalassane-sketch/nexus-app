"use client";

import { useRouter } from "next/navigation";
import { NexusLogo } from "@/components/nexus-logo";
import { Button } from "@/components/ui/button";

// ============================================================
// NEXUS — WORKSPACE PREPARING STATE
// Shown by the (app) layout when the signed-in user's personal
// workspace could not be verified in this request. The bootstrap is
// idempotent and runs again on every page load, so a simple refresh
// retries it. This is the ONLY place the user ever sees the word
// "workspace" during the access-first journey — as a reassurance,
// never as a form.
// ============================================================

export function WorkspacePreparing() {
  const router = useRouter();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-[420px] text-center">
        <div className="mb-6 flex justify-center">
          <NexusLogo size={34} priority className="opacity-80" />
        </div>

        <h1 className="text-[20px] font-semibold tracking-[-0.025em] text-text-primary">
          Preparing your workspace…
        </h1>
        <p className="mx-auto mt-2 max-w-[36ch] text-small text-text-secondary">
          NEXUS is getting your personal workspace ready. This only takes a
          moment — your progress is not lost.
        </p>

        <Button
          type="button"
          size="lg"
          className="mt-6"
          onClick={() => router.refresh()}
        >
          Refresh
        </Button>

        <p className="sr-only" role="status">
          Preparing your workspace
        </p>
      </div>
    </main>
  );
}
