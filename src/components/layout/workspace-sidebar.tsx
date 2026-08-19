"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CheckSquare,
  ChevronsUpDown,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Settings2,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { CreateButtonTrigger } from "@/components/ui/create-button";
import {
  Dropdown,
  DropdownItem,
  DropdownLink,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { NavItem, SectionLabel } from "@/components/ui/navigation";
import { Progress } from "@/components/ui/feedback";
import type { PlanName } from "@/lib/plan-limits";

// ============================================================
// NEXUS — LEVEL 2 NAVIGATION (WORKSPACE SIDEBAR)
// Account header, Create action, grouped destinations with live counters,
// and the real plan usage at the bottom. Every number comes from Supabase
// through the authenticated layout.
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
  name: string;
  username?: string;
  email?: string;
};

export type ShellWorkspace = {
  name: string | null;
  role: string | null;
};

function usePlanPressure(plan: ShellPlan) {
  const ratios = [
    { label: "projects", used: plan.projectsUsed, limit: plan.projectsLimit },
    { label: "active tasks", used: plan.tasksUsed, limit: plan.tasksLimit },
    { label: "goals", used: plan.goalsUsed, limit: plan.goalsLimit },
  ].map((entry) => ({
    ...entry,
    ratio: entry.limit > 0 ? entry.used / entry.limit : 0,
  }));

  return ratios.reduce((max, entry) => (entry.ratio > max.ratio ? entry : max), ratios[0]);
}

export function WorkspaceSidebar({
  user,
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
  const router = useRouter();

  const isActive = (href: string) => pathname === href;

  const handleLogout = async () => {
    try {
      await createClient().auth.signOut();
    } catch (cause) {
      console.error("Logout error:", cause);
    }
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  };

  const pressure = usePlanPressure(plan);
  const initial = (user.name || "U").trim().slice(0, 1).toUpperCase();

  return (
    <div className={cn("flex h-full w-full flex-col gap-1 px-3 py-3", className)}>
      {/* Account header */}
      <Dropdown
        label="Account"
        align="start"
        width={240}
        className="w-full"
        trigger={({ toggle, ref, ariaProps }) => (
          <button
            type="button"
            ref={ref}
            onClick={toggle}
            className="flex w-full items-center gap-2.5 rounded-nav px-2 py-2 text-left transition-colors duration-150 ease-nexus hover:bg-accent-ghost"
            {...ariaProps}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-border-subtle bg-bg-surface text-caption font-medium text-text-primary">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-text-primary">
                {user.name}
              </span>
              <span className="block truncate font-mono text-mono text-text-tertiary">
                {user.email ?? (user.username ? `@${user.username}` : "")}
              </span>
            </span>
            <ChevronsUpDown
              size={14}
              strokeWidth={1.75}
              className="shrink-0 text-text-quaternary"
            />
          </button>
        )}
      >
        <div className="px-2.5 py-2">
          <p className="truncate text-body-medium text-text-primary">{user.name}</p>
          <p className="truncate font-mono text-mono text-text-tertiary">
            {workspace.name ?? "No workspace"}
            {workspace.role ? ` · ${workspace.role}` : ""}
          </p>
        </div>
        <DropdownSeparator />
        <DropdownLink href="/settings" icon={<User size={16} strokeWidth={1.75} />}>
          Profile
        </DropdownLink>
        <DropdownLink
          href="/settings/billing"
          icon={<CreditCard size={16} strokeWidth={1.75} />}
        >
          Billing
        </DropdownLink>
        <DropdownLink href="/upgrade" icon={<Sparkles size={16} strokeWidth={1.75} />}>
          Upgrade
        </DropdownLink>
        <DropdownSeparator />
        <DropdownItem
          icon={<LogOut size={16} strokeWidth={1.75} />}
          onSelect={() => void handleLogout()}
        >
          Log out
        </DropdownItem>
      </Dropdown>

      {/* Create */}
      <Dropdown
        label="Create"
        align="start"
        width={248}
        className="mt-1 w-full"
        trigger={({ toggle, ref, ariaProps }) => (
          <CreateButtonTrigger
            label="Create"
            triggerRef={ref}
            onClick={toggle}
            className="w-full justify-start"
            {...ariaProps}
          />
        )}
      >
        <DropdownLink
          href="/tasks?create=1"
          icon={<CheckSquare size={16} strokeWidth={1.75} />}
        >
          New Task
        </DropdownLink>
        <DropdownLink
          href="/projects?create=1"
          icon={<FolderKanban size={16} strokeWidth={1.75} />}
        >
          New Project
        </DropdownLink>
        <DropdownLink href="/goals?create=1" icon={<Target size={16} strokeWidth={1.75} />}>
          New Goal
        </DropdownLink>
      </Dropdown>

      {/* Navigation */}
      <nav aria-label="Workspace" className="mt-1 overflow-y-auto">
        <SectionLabel>Workspace</SectionLabel>
        <div className="flex flex-col gap-0.5">
          <NavItem
            href="/dashboard"
            label="Dashboard"
            active={isActive("/dashboard")}
            onNavigate={onNavigate}
            icon={<LayoutDashboard size={16} strokeWidth={1.75} />}
          />
          <NavItem
            href="/tasks"
            label="Tasks"
            count={counts.tasks}
            active={isActive("/tasks")}
            onNavigate={onNavigate}
            icon={<CheckSquare size={16} strokeWidth={1.75} />}
          />
          <NavItem
            href="/projects"
            label="Projects"
            count={counts.projects}
            active={isActive("/projects")}
            onNavigate={onNavigate}
            icon={<FolderKanban size={16} strokeWidth={1.75} />}
          />
          <NavItem
            href="/goals"
            label="Goals"
            count={counts.goals}
            active={isActive("/goals")}
            onNavigate={onNavigate}
            icon={<Target size={16} strokeWidth={1.75} />}
          />
        </div>

        <SectionLabel>Activity</SectionLabel>
        <div className="flex flex-col gap-0.5">
          <NavItem
            href="/notifications"
            label="Notifications"
            count={counts.unreadNotifications}
            countTone="accent"
            active={isActive("/notifications")}
            onNavigate={onNavigate}
            icon={<Bell size={16} strokeWidth={1.75} />}
          />
        </div>

        <SectionLabel>Account</SectionLabel>
        <div className="flex flex-col gap-0.5">
          <NavItem
            href="/settings"
            label="Settings"
            active={isActive("/settings")}
            onNavigate={onNavigate}
            icon={<Settings2 size={16} strokeWidth={1.75} />}
          />
          <NavItem
            href="/settings/billing"
            label="Billing"
            active={isActive("/settings/billing")}
            onNavigate={onNavigate}
            icon={<CreditCard size={16} strokeWidth={1.75} />}
          />
          <NavItem
            href="/upgrade"
            label="Upgrade"
            active={isActive("/upgrade")}
            onNavigate={onNavigate}
            icon={<Sparkles size={16} strokeWidth={1.75} />}
          />
        </div>
      </nav>

      {/* Plan usage — real values from the workspace subscription */}
      <div className="mt-auto rounded-card border border-border-subtle bg-bg-subtle p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
            Plan
          </span>
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
          className="mt-1.5"
        />

        {plan.name !== "TEAM" ? (
          <Link
            href="/upgrade"
            onClick={onNavigate}
            className="mt-3 flex h-8 items-center justify-center rounded-pill bg-accent text-caption font-medium text-accent-fg transition-colors duration-150 ease-nexus hover:bg-accent-hover"
          >
            Upgrade plan
          </Link>
        ) : null}
      </div>
    </div>
  );
}
