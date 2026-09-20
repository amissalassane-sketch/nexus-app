"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCheck, IconHelpCircle, IconMinus } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";
import {
  CHECKLIST_ITEMS,
  checklistProgress,
  type ProductFacts,
} from "@/lib/onboarding/model";
import { browserLocale, t } from "@/lib/onboarding/i18n";

export function GetStartedChecklist({
  facts,
  dismissed,
  activated,
  onDismiss,
  onRestore,
  onRestart,
}: {
  facts: ProductFacts;
  dismissed: boolean;
  activated?: boolean;
  onDismiss: () => void;
  onRestore: () => void;
  onRestart: () => void;
}) {
  const locale = browserLocale();
  const pathname = usePathname();
  const { done, total } = checklistProgress(facts);
  const onDashboardNew =
    pathname === "/dashboard" && facts.projectCount === 0 && facts.taskCount === 0;
  const [open, setOpen] = useState(
    !dismissed && done < total && !activated && !onDashboardNew
  );
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const minimize = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setClosing(false);
      setOpen(false);
      onDismiss();
    }, 160);
  }, [closing, onDismiss]);

  const restore = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
    onRestore();
  }, [onRestore]);

  if (done === total && dismissed) return null;

  if (dismissed || !open) {
    return (
      <button
        type="button"
        onClick={restore}
        className="fixed bottom-[84px] left-4 lg:left-auto lg:right-5 z-40 inline-flex h-10 items-center gap-2 rounded-pill border border-border-default bg-bg-surface px-3 text-caption text-text-secondary shadow-dropdown hover:text-text-primary animate-pop-in lg:bottom-5"
        aria-label={t("checklist.title", locale)}
      >
        <NexusIcon icon={IconHelpCircle} />
        {activated
          ? t("checklist.progress", locale)
          : t("checklist.title", locale)}{" "}
        · {done}/{total}
      </button>
    );
  }

  return (
    <section
      aria-label={t("checklist.title", locale)}
      className={cn(
        "fixed bottom-[84px] left-4 lg:left-auto lg:right-5 z-40 w-[min(320px,calc(100vw-24px))] rounded-card border border-border-default bg-bg-surface p-3.5 shadow-dropdown lg:bottom-5",
        closing ? "animate-pop-out pointer-events-none" : "animate-pop-in"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-body-medium text-text-primary">
            {activated
              ? t("checklist.progress", locale)
              : t("checklist.title", locale)}
          </p>
          <p className="mt-0.5 font-mono text-mono text-text-tertiary">
            {done} / {total}
          </p>
        </div>
        <button
          type="button"
          onClick={minimize}
          aria-label="Minimize checklist"
          className="flex h-7 w-7 items-center justify-center rounded-nav text-text-tertiary hover:bg-accent-ghost hover:text-text-primary"
        >
          <NexusIcon icon={IconMinus} />
        </button>
      </div>
      {activated ? (
        <p className="mt-2 text-small text-text-secondary">
          {t("activated.body", locale)}
        </p>
      ) : null}
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
                  {complete ? <NexusIcon icon={IconCheck} px={10} /> : null}
                </span>
                <span className={complete ? "text-text-tertiary line-through" : ""}>
                  {t(item.labelKey, locale)}
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
        {t("checklist.restart", locale)}
      </button>
    </section>
  );
}
