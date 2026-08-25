"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================
// NEXUS — WORKSPACE STATUS BANNER (IN-PRODUCT, NON-BLOCKING)
//
// Rendered INSIDE the app shell whenever the signed-in user's
// workspace context could not be verified for this request.
// The product stays fully rendered around it: navigation, the
// dashboard and every page that does not need workspace data
// work. Only workspace-bound actions stay inert (the managers
// resolve the membership themselves and disable creation until
// it exists).
//
// Two states:
//   preparing — bootstrap is expected to complete shortly
//               (e.g. first load racing the signup commit).
//               One automatic server re-render is scheduled.
//   failed    — the bounded bootstrap attempt returned a
//               structured error. We say so plainly and offer
//               Retry / Continue to NEXUS. The user is never
//               stuck: Continue dismisses the banner and the
//               product keeps working with empty states.
//
// Nothing on this banner exposes raw database errors.
// ============================================================

type BannerState = "preparing" | "failed";

const AUTO_RETRY_DELAY_MS = 2500;

export function WorkspaceStatusBanner({
  state,
  errorKind,
}: {
  state: BannerState;
  errorKind: string | null;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const autoRetried = useRef(false);

  // One bounded automatic recovery pass: if the workspace was mid-flight
  // (the normal case), the server re-render finds it and the banner
  // disappears on its own. Exactly one auto retry — no polling loop.
  useEffect(() => {
    if (state !== "preparing" || autoRetried.current || dismissed) return;
    autoRetried.current = true;
    const timer = setTimeout(() => {
      router.refresh();
    }, AUTO_RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, dismissed, router]);

  const retry = useCallback(() => {
    autoRetried.current = false;
    setDismissed(false);
    router.refresh();
  }, [router]);

  if (dismissed) return null;

  const failed = state === "failed";

  return (
    <div
      role="status"
      aria-live="polite"
      className="page-enter mb-6 flex flex-col gap-3 rounded-card border border-border-subtle bg-bg-subtle/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="text-body font-medium text-text-primary">
          {failed
            ? "We couldn't finish preparing your workspace."
            : "Your workspace is being prepared."}
        </p>
        <p className="mt-1 text-small text-text-secondary">
          {failed
            ? `NEXUS is ready to use. You can continue now and retry the workspace setup when convenient${
                errorKind ? ` (reason: ${errorKind.replace(/_/g, " ").toLowerCase()})` : ""
              }.`
            : "You can already explore NEXUS while we finish setting things up. This usually takes less than a second."}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={retry}>
          <RefreshCw size={14} strokeWidth={1.75} aria-hidden />
          Retry
        </Button>
        {failed ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
          >
            Continue to NEXUS
          </Button>
        ) : null}
      </div>
    </div>
  );
}
