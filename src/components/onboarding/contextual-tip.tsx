"use client";

import { useState } from "react";
import { CONTEXTUAL_TIPS } from "@/lib/onboarding/model";

export function ContextualTip({
  pathname,
  seen,
  onSeen,
}: {
  pathname: string;
  seen: string[];
  onSeen: (id: string) => void;
}) {
  const tip = CONTEXTUAL_TIPS[pathname];
  const [hidden, setHidden] = useState<string | null>(null);
  const visible = Boolean(tip) && !seen.includes(pathname) && hidden !== pathname;

  if (!tip || !visible) return null;

  return (
    <div
      role="status"
      className="pointer-events-auto fixed left-1/2 top-16 z-30 w-[min(380px,calc(100vw-24px))] -translate-x-1/2 rounded-card border border-border-default bg-bg-surface px-4 py-3 shadow-dropdown lg:left-auto lg:right-6 lg:top-[72px] lg:translate-x-0"
    >
      <p className="text-body-medium text-text-primary">{tip.title}</p>
      <p className="mt-1 text-small text-text-secondary">{tip.body}</p>
      <button
        type="button"
        onClick={() => {
          setHidden(pathname);
          onSeen(pathname);
        }}
        className="mt-2 text-caption text-text-tertiary hover:text-text-primary"
      >
        Got it
      </button>
    </div>
  );
}
