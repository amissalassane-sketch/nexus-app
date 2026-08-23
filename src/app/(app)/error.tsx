"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/feedback";
import { Button, ButtonLink } from "@/components/ui/button";

// ============================================================
// NEXUS — ROUTE ERROR BOUNDARY
// A human-readable failure. The stack trace goes to the console for
// developers; the user gets a cause and two ways forward.
// ============================================================

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("NEXUS route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[520px] py-16">
      <ErrorState
        title="We couldn't load this workspace view"
        description="Your session may have expired, or the workspace is temporarily unreachable. Nothing has been changed."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={reset}>Retry</Button>
            <ButtonLink href="/dashboard" variant="secondary">
              Back to Overview
            </ButtonLink>
          </div>
        }
      />
      {error.digest ? (
        <p className="mt-4 text-center font-mono text-mono text-text-quaternary">
          Reference {error.digest}
        </p>
      ) : null}
    </div>
  );
}
