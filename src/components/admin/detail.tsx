import type { ReactNode } from "react";
import Link from "next/link";
import { AdminIcon, AdminIconTile } from "./admin-icons";
import { AdminEyebrow } from "./panel";

// ============================================================
// NEXUS ADMIN — INSPECTOR CHROME
// ============================================================
// Master → detail means every inspector must answer three navigational
// questions at once: what am I looking at (header), where did I come from
// (back link), and what can I do here (actions). The actions section is
// where honesty lives: an action that is planned but not safe yet is
// RENDERED and DISABLED with its reason, never hidden — a control plane
// that silently omits capabilities trains its operator to distrust it.
//
// The header uses the same title step as every other admin page (text-h1,
// 22 / −0.028em) so the inspector and the list it came from are visibly
// the same product, one level apart.
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
      className="inline-flex h-8 items-center gap-1.5 rounded-control px-1.5 text-small text-admin-text-2 no-underline transition-colors duration-[120ms] hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent"
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
          <h1 className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-h1 text-admin-text">
            {title}
            {badges ? <span className="flex flex-wrap items-center gap-1.5">{badges}</span> : null}
          </h1>
          {identity ? (
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {identity}
            </div>
          ) : null}
          {updatedNote ? (
            <p className="mt-2 mono-meta text-admin-text-3">{updatedNote}</p>
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
      <div className="flex items-start gap-3 rounded-surface border border-admin-border bg-admin-surface px-5 py-6">
        <AdminIconTile name="info" className="shrink-0" />
        <div className="min-w-0">
          <h1 className="text-h2 text-admin-text">{title}</h1>
          <p className="mt-1 max-w-[64ch] text-small text-admin-text-2">
            {detail}
          </p>
          <Link
            href={backHref}
            className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-control border border-admin-border bg-admin-surface-2 px-2.5 text-small text-admin-text-2 no-underline transition-colors duration-[120ms] hover:border-admin-border-strong hover:text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent sm:h-8"
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
    <li className="flex flex-col gap-0.5 rounded-control border border-admin-border bg-admin-surface-2/60 px-3 py-2">
      <span
        aria-disabled="true"
        className="inline-flex items-center gap-2 text-small text-admin-text-3"
        title={reason}
      >
        <AdminIcon name="lock" size="action" />
        {label}
      </span>
      <span className="text-caption text-admin-text-3">{reason}</span>
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
