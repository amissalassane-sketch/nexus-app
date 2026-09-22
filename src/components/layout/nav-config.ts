import {
  IconActivity,
  IconBell,
  IconCalendarTime,
  IconChecklist,
  IconCreditCard,
  IconFileUpload,
  IconLayoutDashboard,
  IconLayoutKanban,
  IconNotebook,
  IconPlug,
  IconRadar,
  IconSettings,
  IconSparkles,
  IconTarget,
  type TablerIcon,
} from "@tabler/icons-react";

// ============================================================
// NEXUS — NAVIGATION MODEL
// One declaration of the product's information architecture, shared by
// the sidebar, the mobile navigation, the breadcrumb and the command
// palette. Adding a destination in one place adds it everywhere.
//
// The `icon` map is the navigation half of the NEXUS icon language:
// explicit Tabler component references (tree-shakable), rendered through
// <NexusIcon> at every call site — never resolved from strings.
// ============================================================

export type NavCountKey = "tasks" | "projects" | "goals" | "unreadNotifications";

export type NavEntry = {
  href: string;
  label: string;
  icon: TablerIcon;
  /** Live counter resolved by the shell from Supabase. */
  count?: NavCountKey;
  /** Counter rendered with the intelligence accent instead of muted. */
  accentCount?: boolean;
  /** Short description used by the command palette. */
  hint?: string;
  keywords?: string;
};

export type NavGroup = {
  id: string;
  label?: string;
  items: NavEntry[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "primary",
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        icon: IconLayoutDashboard,
        hint: "What deserves your attention",
        keywords: "home dashboard overview start",
      },
      {
        href: "/app/intelligence",
        label: "Intelligence",
        icon: IconRadar,
        hint: "Signals detected in your workspace",
        keywords: "signals risk blocked insight intelligence",
      },
    ],
  },
  {
    id: "work",
    label: "WORK",
    items: [
      {
        href: "/projects",
        label: "Projects",
        icon: IconLayoutKanban, // Kanban board — the board reads better than a folder for the projects surface.
        count: "projects",
        keywords: "project initiative",
      },
      {
        href: "/tasks",
        label: "Tasks",
        icon: IconChecklist,
        count: "tasks",
        keywords: "task todo work item",
      },
      {
        href: "/goals",
        label: "Goals",
        icon: IconTarget,
        count: "goals",
        keywords: "goal objective outcome",
      },
      {
        href: "/notes",
        label: "Notes",
        icon: IconNotebook,
        hint: "Decisions, meetings, research",
        keywords: "note knowledge decision meeting research idea reference",
      },
      {
        href: "/calendar",
        label: "Calendar",
        icon: IconCalendarTime,
        hint: "Your time, connected to your work",
        keywords: "calendar event meeting time agenda schedule conflict",
      },
      {
        href: "/files",
        label: "Files",
        icon: IconFileUpload,
        hint: "Documents attached to your work",
        keywords: "file upload document attachment storage",
      },
    ],
  },
  {
    id: "workspace",
    label: "WORKSPACE",
    items: [
      {
        href: "/activity",
        label: "Activity",
        icon: IconActivity,
        hint: "Everything that happened",
        keywords: "activity feed history events log",
      },
      {
        href: "/notifications",
        label: "Notifications",
        icon: IconBell,
        count: "unreadNotifications",
        accentCount: true,
        keywords: "notification inbox alerts",
      },
      {
        href: "/integrations",
        label: "Integrations",
        icon: IconPlug,
        hint: "Sources NEXUS can read",
        keywords: "integration connect slack github notion calendar sync",
      },
    ],
  },
];

export const NAV_FOOTER: NavEntry[] = [
  {
    href: "/settings",
    label: "Settings",
    icon: IconSettings,
    keywords: "settings preferences profile account workspace",
  },
  {
    href: "/settings/billing",
    label: "Billing",
    icon: IconCreditCard,
    keywords: "billing plan invoice subscription",
  },
  {
    href: "/upgrade",
    label: "Plans",
    icon: IconSparkles,
    keywords: "upgrade plan pricing pro team",
  },
];

/** Flat list of every destination, used by search and the breadcrumb. */
export const ALL_NAV_ENTRIES: NavEntry[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  ...NAV_FOOTER,
];

/** Compact mobile navigation: four primary destinations + the drawer trigger. */
export const MOBILE_NAV: NavEntry[] = [
  ALL_NAV_ENTRIES[0], // Overview
  ALL_NAV_ENTRIES[1], // Intelligence
  ALL_NAV_ENTRIES[2], // Projects
  ALL_NAV_ENTRIES[3], // Tasks
];

const TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/app/intelligence": "Intelligence",
  "/projects": "Projects",
  "/tasks": "Tasks",
  "/goals": "Goals",
  "/notes": "Notes",
  "/calendar": "Calendar",
  "/files": "Files",
  "/activity": "Activity",
  "/notifications": "Notifications",
  "/integrations": "Integrations",
  "/settings": "Settings",
  "/settings/billing": "Billing",
  "/upgrade": "Plans",
};

/** Breadcrumb segments for a pathname: ["Workspace", "Settings", "Billing"]. */
export function breadcrumbFor(pathname: string): string[] {
  const exact = TITLES[pathname];
  if (exact) {
    return pathname.startsWith("/settings/")
      ? ["Settings", exact]
      : [exact];
  }

  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment) =>
    segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
  );
}

/** True when `href` is the active destination for `pathname`. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(`${href}/`);
}
