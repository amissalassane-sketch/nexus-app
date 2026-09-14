// ============================================================
// NEXUS ADMIN — ICON SYSTEM
// ============================================================
// One icon library: @tabler/icons-react. No Lucide, no Heroicons, no
// hand-downloaded SVG, no inline path soup.
//
// The wrapper exists for three reasons:
//   1. It fixes the visual language in one place — 24×24 grid, stroke
//      1.75, outline, currentColor — so an admin screen cannot drift into
//      mixed stroke weights the way an app with 78 icon call sites can.
//   2. It fixes the size scale: navigation 18, toolbar 18, compact
//      actions 16, empty states 24–32. Those are the four sizes the
//      control plane uses, and nothing else is offered.
//   3. It makes the accessibility default correct: an icon is decorative
//      (aria-hidden) unless the caller names it, in which case it becomes
//      role="img" with a real label.
// ============================================================

import {
  IconActivity,
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowUpRight,
  IconBuilding,
  IconBug,
  IconChartArea,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconCloud,
  IconCpu,
  IconCreditCard,
  IconDatabase,
  IconDevices,
  IconFileInvoice,
  IconFilter,
  IconFlag,
  IconGauge,
  IconHistory,
  IconLock,
  IconLogout,
  IconMenu,
  IconPlug,
  IconRefresh,
  IconSearch,
  IconServer,
  IconSettings,
  IconShield,
  IconShieldLock,
  IconSitemap,
  IconSparkles,
  IconUsers,
  IconWallet,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { AdminIconName } from "@/lib/admin/nav";

/** The four sizes of the control plane. Numbers, not vibes. */
export const ADMIN_ICON_SIZES = {
  /** Sidebar entries, section titles. */
  nav: 18,
  /** Page toolbars. */
  toolbar: 18,
  /** Inline row actions, table affordances. */
  action: 16,
  /** Empty states. */
  state: 24,
  /** Empty states that carry the screen. */
  stateLg: 32,
} as const;

export type AdminIconSize = keyof typeof ADMIN_ICON_SIZES;

/** Every icon the admin surface is allowed to use. Adding an entry here
 *  is a deliberate act, which is the point: the icon set stays small. */
const NAV_ICONS: Record<AdminIconName, TablerIcon> = {
  gauge: IconGauge,
  users: IconUsers,
  building: IconBuilding,
  sitemap: IconSitemap,
  chart: IconChartArea,
  creditCard: IconCreditCard,
  wallet: IconWallet,
  invoice: IconFileInvoice,
  activity: IconActivity,
  sparkles: IconSparkles,
  server: IconServer,
  bug: IconBug,
  alert: IconAlertTriangle,
  shield: IconShieldLock,
  sessions: IconDevices,
  history: IconHistory,
  flag: IconFlag,
  plug: IconPlug,
  settings: IconSettings,
};

export type AdminUiIconName =
  | "search"
  | "refresh"
  | "filter"
  | "menu"
  | "close"
  | "logout"
  | "check"
  | "cross"
  | "warning"
  | "info"
  | "clock"
  | "external"
  | "database"
  | "cloud"
  | "cpu"
  | "shield"
  | "lock"
  | "server";

const UI_ICONS: Record<AdminUiIconName, TablerIcon> = {
  search: IconSearch,
  refresh: IconRefresh,
  filter: IconFilter,
  menu: IconMenu,
  close: IconX,
  logout: IconLogout,
  check: IconCircleCheck,
  cross: IconCircleX,
  warning: IconAlertTriangle,
  info: IconAlertCircle,
  clock: IconClock,
  external: IconArrowUpRight,
  database: IconDatabase,
  cloud: IconCloud,
  cpu: IconCpu,
  shield: IconShield,
  lock: IconLock,
  server: IconServer,
};

export type AdminIconProps = {
  /** A navigation icon (sidebar model) or a UI icon (chrome). */
  name: AdminIconName | AdminUiIconName;
  size?: AdminIconSize;
  /** Exact pixel size, for the rare case the scale does not fit. */
  px?: number;
  /** Accessible name. Omit it for a decorative icon — it is then hidden
   *  from assistive technology, which is the correct default. */
  label?: string;
  className?: string;
  /** Stroke width. 1.75 is the system default; only override it to make
   *  a single large empty-state icon feel lighter. */
  stroke?: number;
};

export function AdminIcon({
  name,
  size = "action",
  px,
  label,
  className,
  stroke = 1.75,
}: AdminIconProps) {
  const Component =
    (UI_ICONS as Record<string, TablerIcon | undefined>)[name] ??
    (NAV_ICONS as Record<string, TablerIcon | undefined>)[name];

  if (!Component) {
    // An unmapped name is a build-time mistake, not something to paper
    // over with a placeholder glyph. Render nothing and say so in the
    // markup so it is visible in review rather than invisible in the UI.
    return <span data-admin-icon-missing={name} aria-hidden="true" />;
  }

  const pixels = px ?? ADMIN_ICON_SIZES[size];

  return (
    <Component
      size={pixels}
      stroke={stroke}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn("shrink-0", className)}
    />
  );
}

/** Decorative wrapper used behind empty states: the icon sits in a
 *  bordered square so it reads as a place, not as a stray glyph. */
export function AdminIconTile({
  name,
  tone = "neutral",
  className,
}: {
  name: AdminIconName | AdminUiIconName;
  tone?: "neutral" | "accent" | "warning" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "border-admin-border bg-admin-surface text-admin-text-2",
    accent: "border-admin-accent-border bg-admin-accent-bg text-admin-accent",
    warning: "border-admin-warning-border bg-admin-warning-bg text-admin-warning",
    danger: "border-admin-danger-border bg-admin-danger-bg text-admin-danger",
  } as const;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-[10px] border",
        tones[tone],
        className
      )}
    >
      <AdminIcon name={name} size="state" />
    </span>
  );
}
