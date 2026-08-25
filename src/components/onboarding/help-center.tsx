"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const TOPICS = [
  {
    title: "Overview",
    body: "Your command center. What needs attention, and what to do next.",
    href: "/dashboard",
  },
  {
    title: "Projects",
    body: "Organize work around outcomes so NEXUS can track risk and momentum.",
    href: "/projects",
  },
  {
    title: "Tasks",
    body: "Turn plans into action. Dates and priority feed Intelligence.",
    href: "/tasks",
  },
  {
    title: "Goals",
    body: "Keep work aligned with what you are trying to achieve.",
    href: "/goals",
  },
  {
    title: "Intelligence",
    body: "Ask NEXUS to understand your workspace and recommend the next step.",
    href: "/app/intelligence",
  },
];

export function HelpCenter({
  open,
  onClose,
  onRestart,
}: {
  open: boolean;
  onClose: () => void;
  onRestart: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close help"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nexus-help-title"
        className="relative z-[76] max-h-[86dvh] w-[min(440px,100vw)] overflow-y-auto rounded-t-card border border-border-default bg-bg-surface p-5 sm:rounded-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-text-quaternary">NEXUS Guide</p>
            <h2
              id="nexus-help-title"
              className="mt-1 text-[18px] font-semibold text-text-primary"
            >
              Help
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-nav text-text-tertiary hover:bg-accent-ghost hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>
        <ul className="mt-4 divide-y divide-border-subtle border-y border-border-subtle">
          {TOPICS.map((topic) => (
            <li key={topic.href}>
              <Link
                href={topic.href}
                onClick={onClose}
                className="block py-3 hover:bg-accent-ghost"
              >
                <p className="text-body-medium text-text-primary">{topic.title}</p>
                <p className="mt-0.5 text-small text-text-secondary">
                  {topic.body}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-caption text-text-tertiary">
          Shortcuts: ⌘K search · C create · Esc close
        </p>
        <button
          type="button"
          onClick={() => {
            onRestart();
            onClose();
          }}
          className="mt-3 inline-flex h-9 items-center rounded-input border border-border-default px-3 text-button text-text-secondary hover:text-text-primary"
        >
          Restart first-run guide
        </button>
      </div>
    </div>
  );
}
