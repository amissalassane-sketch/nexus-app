"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================
// NEXUS — PROFILE COMPLETION PROMPT (NON-BLOCKING)
// A subtle card shown at the top of the product content when the
// user's NEXUS profile is incomplete.
//
// Timing rules (access-first):
//   - the dashboard renders FIRST; the user sees the product;
//   - this card appears below the fold of attention, never as a
//     modal or a full-screen takeover;
//   - "Later" dismisses it for the rest of the session; it can
//     reappear later (next visit) without ever blocking anything;
//   - profile completeness has NOTHING to do with authorization —
//     dismissing or ignoring this card changes nothing about access.
// ============================================================

export function ProfileCompletionPrompt({
  missingSummary,
  onOpen,
}: {
  /** Short hint built server-side, e.g. "name and username" or "username". */
  missingSummary: string;
  onOpen: () => void;
}) {
  // In-memory dismissal: survives in-app navigation (the shell stays
  // mounted) and can reappear on a later visit. No storage side effects,
  // so there is nothing to hydrate.
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Complete your profile"
      className="mb-6 flex flex-col gap-3 rounded-card border border-border-subtle bg-bg-subtle/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-input border border-border-subtle bg-bg-surface text-text-tertiary"
        >
          <UserRound size={15} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-body-medium text-text-primary">
            Complete your profile
          </p>
          <p className="mt-0.5 max-w-[52ch] text-small text-text-secondary">
            Add your {missingSummary} so your NEXUS workspace can recognise
            you. You can do this any time from your account menu.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
        <Button type="button" variant="ghost" size="md" onClick={() => setDismissed(true)}>
          Later
        </Button>
        <Button type="button" size="md" onClick={onOpen}>
          Complete profile
        </Button>
      </div>
    </div>
  );
}
