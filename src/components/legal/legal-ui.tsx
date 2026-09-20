import type { ReactNode } from "react";
import { IconDatabase, IconInfoCircle, IconShieldExclamation, IconSparkles } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { cn } from "@/lib/cn";

export function LegalSection({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 border-b border-border-subtle/60 py-10 first:pt-4 last:border-b-0",
        className
      )}
    >
      {children}
    </section>
  );
}

export function LegalSectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-[22px] font-medium leading-snug tracking-[-0.025em] text-text-primary sm:text-[24px]",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function LegalSubsectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "mt-6 text-[17px] font-medium leading-snug tracking-[-0.015em] text-text-primary",
        className
      )}
    >
      {children}
    </h3>
  );
}

export function LegalParagraph({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mt-4 text-[14.5px] leading-[1.7] text-text-secondary sm:text-[15px]",
        className
      )}
    >
      {children}
    </p>
  );
}

export function LegalList({
  children,
  ordered = false,
  className,
}: {
  children: ReactNode;
  ordered?: boolean;
  className?: string;
}) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      className={cn(
        "mt-4 space-y-2.5 pl-5 text-[14.5px] leading-[1.7] text-text-secondary sm:text-[15px]",
        ordered ? "list-decimal" : "list-disc",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function LegalListItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <li className={cn("pl-1 text-text-secondary", className)}>{children}</li>;
}

export function LegalCallout({
  icon = "info",
  title,
  children,
  className,
}: {
  icon?: "info" | "warning" | "ai" | "database";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const IconComponent = {
    info: IconInfoCircle,
    warning: IconShieldExclamation,
    ai: IconSparkles,
    database: IconDatabase,
  }[icon];

  const toneClasses = {
    info: "border-border-default bg-bg-surface/80 text-text-primary",
    warning: "border-warning-border bg-warning-bg/40 text-text-primary",
    ai: "border-lavender-border bg-lavender-subtle/30 text-text-primary",
    database: "border-info-border bg-info-bg/30 text-text-primary",
  }[icon];

  const iconColors = {
    info: "text-text-tertiary",
    warning: "text-warning",
    ai: "text-lavender",
    database: "text-info",
  }[icon];

  return (
    <aside
      className={cn(
        "mt-5 overflow-hidden rounded-card border p-4 sm:p-5",
        toneClasses,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <NexusIcon
          icon={IconComponent}
          size="toolbar"
          className={cn("mt-0.5", iconColors)}
        />
        <div className="min-w-0 flex-1 text-small leading-relaxed text-text-secondary">
          {title ? (
            <h4 className="mb-1 text-h4 font-medium text-text-primary">{title}</h4>
          ) : null}
          {children}
        </div>
      </div>
    </aside>
  );
}

export function LegalTable({
  headers,
  rows,
  caption,
  className,
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  caption?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-6 overflow-x-auto rounded-card border border-border-subtle bg-bg-surface/40",
        className
      )}
    >
      <table className="w-full min-w-[540px] text-left text-small">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="border-b border-border-subtle bg-bg-surface text-text-quaternary">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                scope="col"
                className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.06em]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className="transition-colors duration-150 hover:bg-accent-ghost/40"
            >
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  className="px-4 py-3 text-text-secondary align-top"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalContactBox({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-6 rounded-card border border-border-default bg-bg-surface/60 p-5 sm:p-6",
        className
      )}
    >
      <h3 className="text-h3 text-text-primary">Legal & Compliance Inquiries</h3>
      <p className="mt-2 text-small text-text-secondary">
        If you have questions regarding our legal agreements, data privacy practices,
        or acceptable use policies, please contact our legal team:
      </p>

      <dl className="mt-4 grid gap-3 font-mono text-small sm:grid-cols-2">
        <div className="rounded-input border border-border-subtle bg-bg-base/60 p-3">
          <dt className="text-[11px] uppercase tracking-wider text-text-quaternary">
            Legal Entity
          </dt>
          <dd className="mt-1 font-sans text-body text-text-primary">
            [LEGAL ENTITY NAME]
          </dd>
        </div>
        <div className="rounded-input border border-border-subtle bg-bg-base/60 p-3">
          <dt className="text-[11px] uppercase tracking-wider text-text-quaternary">
            Legal Inquiries Email
          </dt>
          <dd className="mt-1 font-sans text-body text-text-primary">
            [LEGAL CONTACT EMAIL]
          </dd>
        </div>
        <div className="rounded-input border border-border-subtle bg-bg-base/60 p-3 sm:col-span-2">
          <dt className="text-[11px] uppercase tracking-wider text-text-quaternary">
            Registered Business Address
          </dt>
          <dd className="mt-1 font-sans text-body text-text-primary">
            [BUSINESS ADDRESS]
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function LegalDisclaimerNotice({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-8 rounded-card border border-border-subtle bg-bg-subtle/50 p-4 text-center font-mono text-[11.5px] leading-relaxed text-text-quaternary",
        className
      )}
    >
      This legal documentation reflects the operational architecture of NEXUS as of
      September 2026. These terms provide a structured baseline and do not constitute
      formal legal certification. Consult qualified legal counsel for organizational compliance.
    </div>
  );
}
