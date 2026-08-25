"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CircleHelp, Minus } from "lucide-react";
import {
  CHECKLIST_ITEMS,
  checklistProgress,
  type ProductFacts,
} from "@/lib/onboarding/model";

export function GetStartedChecklist({
  facts,
  dismissed,
  onDismiss,
  onRestore,
  onRestart,
}: {
  facts: ProductFacts;
  dismissed: boolean;
  onDismiss: () => void;
  onRestore: () => void;
  onRestart: () => void;
}) {
  const { done, total } = checklistProgress(facts);
  const [open, setOpen] = useState(!dismissed && done < total);

  if (done === total) return null;

  if (dismissed || !open) {
    return (
      <button
        type="button"
        onClick={() => {
          onRestore();
          setOpen(true);
        }}
        className="fixed bottom-[84px] right-4 z-40 inline-flex h-10 items-center gap-2 rounded-pill border border-border-default bg-bg-surface px-3 text-caption text-text-secondary shadow-dropdown hover:text-text-primary lg:bottom-5"
        aria-label="Open get started checklist"
      >
        <CircleHelp size={14} strokeWidth={1.75} />
        Get started · {done}/{total}
      </button>
    );
  }

  return (
    <section
      aria-label="Get started with NEXUS"
      className="fixed bottom-[84px] right-4 z-40 w-[min(320px,calc(100vw-24px))] rounded-card border border-border-default bg-bg-surface p-3.5 shadow-dropdown lg:bottom-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-body-medium text-text-primary">
            Get started with NEXUS
          </p>
          <p className="mt-0.5 font-mono text-mono text-text-tertiary">
            {done} / {total}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onDismiss();
          }}
          aria-label="Minimize checklist"
          className="flex h-7 w-7 items-center justify-center rounded-nav text-text-tertiary hover:bg-accent-ghost hover:text-text-primary"
        >
          <Minus size={14} />
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {CHECKLIST_ITEMS.map((item) => {
          const complete = item.done(facts);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-2 rounded-nav px-1.5 py-1.5 text-small text-text-secondary hover:bg-accent-ghost hover:text-text-primary"
              >
                <span
                  className={
                    complete
                      ? "flex h-4 w-4 items-center justify-center rounded-pill bg-success text-black"
                      : "flex h-4 w-4 items-center justify-center rounded-pill border border-border-strong"
                  }
                >
                  {complete ? <Check size={10} strokeWidth={2.5} /> : null}
                </span>
                <span className={complete ? "text-text-tertiary line-through" : ""}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onRestart}
        className="mt-2 text-caption text-text-tertiary hover:text-text-primary"
      >
        Restart the guide
      </button>
    </section>
  );
}
