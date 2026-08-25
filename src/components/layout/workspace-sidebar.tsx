"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  CheckSquare,
  ChevronsUpDown,
  CreditCard,
  FolderKanban,
  Plus,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { NexusWordmark } from "@/components/nexus-logo";
import {
  Dropdown,
  DropdownLabel,
  DropdownLink,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { NavItem, SectionLabel } from "@/components/ui/navigation";
import { Progress } from "@/components/ui/feedback";
import { NAV_FOOTER, NAV_GROUPS, isNavActive } from "@/components/layout/nav-config";
import type { PlanName } from "@/lib/plan-limits";

// ============================================================
// NEXUS — WORKSPACE SIDEBAR
// Brand · workspace switcher · search · create · grouped navigation with
// live counters · plan usage. Every number comes from Supabase through
// the authenticated layout — nothing here is decorative.
// ============================================================

export type ShellCounts = {
  tasks: number;
  projects: number;
  goals: number;
  unreadNotifications: number;
};

export type ShellPlan = {
  name: PlanName;
  projectsUsed: number;
  projectsLimit: number;
  tasksUsed: number;
  tasksLimit: number;
  goalsUsed: number;
  goalsLimit: number;
};

export type ShellUser = {
  /** The name the user (or their OAuth provider) provided — `null` until
   *  they complete their profile. UI renders a fallback, never a guess. */
  name: string | null;
  username?: string;
  email?: string;
  /** UI guidance only: name AND username both exist. Never an access gate. */
  profileComplete: boolean;
};

export type ShellWorkspace = {
  name: string | null;
  role: string | null;
};

function planPressure(plan: ShellPlan) {
  const ratios = [
    { label: "projects", used: plan.projectsUsed, limit: plan.projectsLimit },
    { label: "active tasks", used: plan.tasksUsed, limit: plan.tasksLimit },
    { label: "goals", used: plan.goalsUsed, limit: plan.goalsLimit },
  ].map((entry) => ({
    ...entry,
    ratio: entry.limit > 0 ? entry.used / entry.limit : 0,
  }));

  return ratios.reduce(
    (max, entry) => (entry.ratio > max.ratio ? entry : max),
    ratios[0]
  );
}

function openCommandPalette() {
  window.dispatchEvent(new Event("nexus:open-command"));
}

export function WorkspaceSidebar({
  workspace,
  counts,
  plan,
  onNavigate,
  className,
}: {
  user: ShellUser;
  workspace: ShellWorkspace;
  counts: ShellCounts;
  plan: ShellPlan;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const pressure = planPressure(plan);
  const workspaceName = workspace.name ?? "No workspace";

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      {/* Brand — hidden below lg, where the mobile header carries it */}
      <div className="hidden h-14 shrink-0 items-center px-4 lg:flex">
        <Link
          href="/dashboard"
          aria-label="NEXUS — Overview"
          className="group inline-flex items-center rounded-nav outline-none"
        >
          <NexusWordmark
            size={20}
            priority
            className="transition-opacity duration-150 ease-nexus group-hover:opacity-80"
          />
        </Link>
      </div>

      <div className="flex flex-col gap-1.5 px-3 pt-3 lg:pt-0">
        {/* Workspace switcher */}
        <Dropdown
          label="Workspace"
          align="start"
          width={244}
          className="w-full"
          trigger={({ toggle, ref, ariaProps }) => (
            <button
              type="button"
              ref={ref}
              onClick={toggle}
              className="flex h-11 w-full items-center gap-2.5 rounded-nav border border-border-subtle bg-bg-surface/50 px-2 text-left transition-colors duration-150 ease-nexus hover:border-border-default hover:bg-bg-surface"
              {...ariaProps}
            >
              <span
                aria-hidden="true"
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[6px] border border-border-default bg-bg-surface-2 text-text-tertiary"
              >
                <Boxes size={13} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-text-primary">
                  {workspaceName}
                </span>
                <span className="eyebrow block truncate text-text-quaternary">
                  {workspace.role ?? "workspace"}
                </span>
              </span>
              <ChevronsUpDown
                size={13}
                strokeWidth={1.75}
                className="shrink-0 text-text-quaternary"
                aria-hidden="true"
              />
            </button>
          )}
        >
          <DropdownLabel>Current workspace</DropdownLabel>
          <div className="px-2.5 pb-2">
            <p className="truncate text-body-medium text-text-primary">
              {workspaceName}
            </p>
            <p className="truncate font-mono text-mono text-text-tertiary">
              {plan.name} · {workspace.role ?? "member"}
            </p>
          </div>
          <DropdownSeparator />
          <DropdownLink
            href="/settings"
            icon={<Sparkles size={15} strokeWidth={1.75} />}
          >
            Workspace settings
          </DropdownLink>
          <DropdownLink
            href="/settings/billing"
            icon={<CreditCard size={15} strokeWidth={1.75} />}
          >
            Plan and billing
          </DropdownLink>
        </Dropdown>

        {/* Search — the command interface entry point */}
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex h-9 w-full items-center gap-2.5 rounded-nav border border-border-subtle bg-transparent px-2.5 text-left text-[13px] text-text-tertiary transition-colors duration-150 ease-nexus hover:border-border-default hover:bg-accent-ghost hover:text-text-secondary"
        >
          <Search size={14} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Search NEXUS…</span>
          <kbd className="shrink-0 rounded-[4px] border border-border-subtle px-1 font-mono text-[10px] leading-[15px] text-text-quaternary">
            ⌘K
          </kbd>
        </button>

        {/* Create */}
        <Dropdown
          label="Create"
          align="start"
          width={244}
          className="w-full"
          trigger={({ toggle, ref, ariaProps }) => (
            <button
              type="button"
              ref={ref}
              onClick={toggle}
              data-guide="create-project"
              className="flex h-9 w-full items-center gap-2 rounded-nav bg-accent px-2.5 text-[13px] font-medium text-accent-fg transition-[background-color,transform] duration-[140ms] ease-nexus hover:bg-accent-hover active:scale-[0.99]"
              {...ariaProps}
            >
              <Plus size={15} strokeWidth={2} aria-hidden="true" />
              <span className="flex-1 text-left">Create</span>
              <kbd className="font-mono text-[10px] text-black/45">C</kbd>
            </button>
          )}
        >
          <DropdownLink
            href="/tasks?create=1"
            icon={<CheckSquare size={15} strokeWidth={1.75} />}
          >
            Task
          </DropdownLink>
          <DropdownLink
            href="/projects?create=1"
            icon={<FolderKanban size={15} strokeWidth={1.75} />}
            data-guide="new-project"
          >
            Project
          </DropdownLink>
          <DropdownLink
            href="/goals?create=1"
            icon={<Target size={15} strokeWidth={1.75} />}
          >
            Goal
          </DropdownLink>
        </Dropdown>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Workspace navigation"
        className="mt-1 min-h-0 flex-1 overflow-y-auto px-3 pb-3"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className={group.label ? undefined : "pt-3"}>
            {group.label ? <SectionLabel>{group.label}</SectionLabel> : null}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                active={isNavActive(pathname, item.href)}
                count={item.count ? counts[item.count] : undefined}
                countTone={item.accentCount ? "accent" : "muted"}
                onNavigate={onNavigate}
                icon={<item.icon size={15} strokeWidth={1.75} />}
                data-guide={
                  item.href === "/app/intelligence"
                    ? "intelligence-nav"
                    : item.href === "/projects"
                      ? "projects-nav"
                      : item.href === "/tasks"
                        ? "tasks-nav"
                        : item.href === "/goals"
                          ? "goals-nav"
                          : item.href === "/dashboard"
                            ? "dashboard"
                            : undefined
                }
              />
              ))}
            </div>
          </div>
        ))}

        <SectionLabel>Account</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {NAV_FOOTER.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              active={isNavActive(pathname, item.href)}
              onNavigate={onNavigate}
              icon={<item.icon size={15} strokeWidth={1.75} />}
              data-guide={item.href === "/settings" ? "settings-nav" : undefined}
            />
          ))}
        </div>
      </nav>

      {/* Plan usage — real values from the workspace subscription */}
      <div className="shrink-0 border-t border-border-subtle p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow text-text-quaternary">Plan</span>
          <span
            className={cn(
              "font-mono text-mono",
              plan.name === "FREE" ? "text-text-secondary" : "text-lavender"
            )}
          >
            {plan.name}
          </span>
        </div>

        <p className="mt-2 text-caption text-text-tertiary">
          <span className="font-mono tabular-nums text-text-secondary">
            {pressure.used}/{pressure.limit}
          </span>{" "}
          {pressure.label}
        </p>
        <Progress
          value={pressure.ratio * 100}
          label={`${pressure.label} usage`}
          tone={pressure.ratio >= 0.8 ? "lavender" : "white"}
          className="mt-2"
        />

        {plan.name !== "TEAM" ? (
          <Link
            href="/upgrade"
            onClick={onNavigate}
            className="mt-3 flex h-8 items-center justify-center rounded-nav border border-border-default text-caption font-medium text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:bg-accent-ghost hover:text-text-primary"
          >
            Compare plans
          </Link>
        ) : null}
      </div>
    </div>
  );
}
