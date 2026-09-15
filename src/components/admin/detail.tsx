import type { ReactNode } from "react";
import Link from "next/link";
import { AdminIcon, AdminIconTile } from "./admin-icons";
import { AdminEyebrow } from "./panel";

// ============================================================
// NEXUS ADMIN — INSPECTOR CHROME (PR 2)
// ============================================================
// Master → detail means every inspector must answer three navigational
// questions at once: what am I looking at (header), where did I come from
// (back link), and what can I do here (actions). The actions section is
// where honesty lives: an action that is planned but not safe yet is
// RENDERED and DISABLED with its reason, never hidden — a control plane
// that silently omits capabilities trains its operator to distrust it.
// ============================================================

export function AdminBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-7 items-center gap-1.5 rounded-[7px] px-1 text-[12.5px] leading-[18px] text-admin-text-2 no-underline transition-colors duration-150 hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
    >
      <AdminIcon name="arrowLeft" size="action" />
      {label}
    </Link>
  );
}

export function AdminDetailHeader({
  eyebrow,
  title,
  identity,
  badges,
  backHref,
  backLabel,
  actions,
  updatedNote,
}: {
  eyebrow: string;
  title: ReactNode;
  /** Technical identity line: ids, slug, email. Mono by rule. */
  identity?: ReactNode;
  badges?: ReactNode;
  backHref: string;
  backLabel: string;
  actions?: ReactNode;
  /** "Read <iso>" — the same provenance line the lists carry. */
  updatedNote?: string;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AdminBackLink href={backHref} label={backLabel} />
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <AdminEyebrow>{eyebrow}</AdminEyebrow>
          <h1 className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[20px] font-semibold leading-[26px] tracking-[-0.022em] text-admin-text">
            {title}
            {badges ? <span className="flex flex-wrap items-center gap-1.5">{badges}</span> : null}
          </h1>
          {identity ? (
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {identity}
            </div>
          ) : null}
          {updatedNote ? (
            <p className="mt-2 font-mono text-[11px] leading-[16px] text-admin-text-3">
              {updatedNote}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/** The clean "not found". Rendered in the shell — NOT a raw next/notFound
 *  bubble — because the root product 404 is a marketing-screen design and
 *  an admin refusal should not borrow it. */
export function AdminNotFoundState({
  title,
  detail,
  backHref,
  backLabel,
}: {
  title: string;
  detail: ReactNode;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-start gap-4">
      <AdminBackLink href={backHref} label={backLabel} />
      <div className="flex items-start gap-3 rounded-[10px] border border-admin-border bg-admin-surface px-5 py-6">
        <AdminIconTile name="info" className="shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold leading-[22px] text-admin-text">{title}</h1>
          <p className="mt-1 max-w-[64ch] text-[12.5px] leading-[18px] text-admin-text-2">
            {detail}
          </p>
          <Link
            href={backHref}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-admin-border bg-admin-surface-2 px-2.5 text-[12.5px] leading-[18px] text-admin-text-2 no-underline transition-colors duration-150 hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
          >
            <AdminIcon name="arrowLeft" size="action" />
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** An action the control plane can see coming but must not offer yet.
 *  Disabled, labelled, and explained — the same "planned, visibly not
 *  available" contract the sidebar uses for future sections. */
export function AdminUnavailableAction({
  label,
  reason,
}: {
  label: string;
  reason: string;
}) {
  return (
    <li className="flex flex-col gap-0.5 rounded-[8px] border border-admin-border/70 bg-admin-surface-2/40 px-3 py-2">
      <span
        aria-disabled="true"
        className="inline-flex items-center gap-2 text-[12.5px] leading-[18px] text-admin-text-3"
        title={reason}
      >
        <AdminIcon name="lock" size="action" />
        {label}
      </span>
      <span className="text-[11.5px] leading-[16px] text-admin-text-3">{reason}</span>
    </li>
  );
}

export function AdminActionsPanel({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Record actions" className="flex flex-col gap-2">
      {children}
    </section>
  );
}
