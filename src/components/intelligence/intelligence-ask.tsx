"use client";

import { useState } from "react";
import { emitActivation, trackEvent } from "@/lib/onboarding/analytics";
import { browserLocale, t } from "@/lib/onboarding/i18n";
import type { WorkspaceContext } from "@/lib/intelligence/engine";

export function IntelligenceAsk({ context }: { context: WorkspaceContext }) {
  const locale = browserLocale();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");

  const send = () => {
    const text = query.trim();
    if (!text) {
      setAnswer(t("ask.empty", locale));
      return;
    }
    emitActivation("intelligence");
    trackEvent("intelligence_interaction");
    setAnswer(
      `${context.projects} projects · ${context.openTasks} open tasks · ${context.goals} goals. ${
        context.overdueTasks > 0
          ? `${context.overdueTasks} overdue.`
          : "Nothing overdue."
      }`
    );
  };

  return (
    <div className="rounded-card border border-border-subtle bg-bg-subtle/60 p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          data-guide="intelligence-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
          placeholder={t("ask.placeholder", locale)}
          aria-label={t("ask.placeholder", locale)}
          className="h-10 min-w-0 flex-1 rounded-input border border-border-default bg-bg-surface px-3 text-body text-text-primary outline-none focus:border-border-focus"
        />
        <button
          type="button"
          data-guide="intelligence-send"
          onClick={send}
          className="inline-flex h-10 items-center justify-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg hover:bg-accent-hover"
        >
          {t("ask.send", locale)}
        </button>
      </div>
      {answer ? (
        <p className="mt-2 text-small text-text-secondary" role="status">
          {answer}
        </p>
      ) : null}
    </div>
  );
}
