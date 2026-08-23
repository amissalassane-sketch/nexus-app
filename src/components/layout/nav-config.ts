import {
  Activity,
  Bell,
  CheckSquare,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  Plug,
  Radar,
  Settings2,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

// ============================================================
// NEXUS — NAVIGATION MODEL
// One declaration of the product's information architecture, shared by
// the sidebar, the mobile navigation, the breadcrumb and the command
// palette. Adding a destination in one place adds it everywhere.
// ============================================================

export type NavCountKey = "tasks" | "projects" | "goals" | "unreadNotifications";

export type NavEntry = {
  href: string;
  label: string;
  icon: LucideIcon;
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
        icon: LayoutDashboard,
        hint: "What deserves your attention",
        keywords: "home dashboard overview start",
      },
      {
        href: "/intelligence",
        label: "Intelligence",
        icon: Radar,
        hint: "Signals detected in your workspace",
        keywords: "signals risk blocked insight intelligence",
      },
    ],
  },
  {
    id: "work",
    label: "Work",
    items: [
      {
        href: "/projects",
        label: "Projects",
        icon: FolderKanban,
        count: "projects",
        keywords: "project initiative",
      },
      {
        href: "/tasks",
        label: "Tasks",
        icon: CheckSquare,
        count: "tasks",
        keywords: "task todo work item",
      },
      {
        href: "/goals",
        label: "Goals",
        icon: Target,
        count: "goals",
        keywords: "goal objective outcome",
      },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        href: "/activity",
        label: "Activity",
        icon: Activity,
        hint: "Everything that happened",
        keywords: "activity feed history events log",
      },
      {
        href: "/notifications",
        label: "Notifications",
        icon: Bell,
        count: "unreadNotifications",
        accentCount: true,
        keywords: "notification inbox alerts",
      },
      {
        href: "/integrations",
        label: "Integrations",
        icon: Plug,
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
    icon: Settings2,
    keywords: "settings preferences profile account workspace",
  },
  {
    href: "/settings/billing",
    label: "Billing",
    icon: CreditCard,
    keywords: "billing plan invoice subscription",
  },
  {
    href: "/upgrade",
    label: "Plans",
    icon: Sparkles,
    keywords: "upgrade plan pricing pro team",
  },
];

/** Flat list of every destination, used by search and the breadcrumb. */
export const ALL_NAV_ENTRIES: NavEntry[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  ...NAV_FOOTER,
];

/** Compact mobile navigation: five slots, the last one opens the drawer. */
export const MOBILE_NAV: NavEntry[] = [
  ALL_NAV_ENTRIES[0],
  ALL_NAV_ENTRIES[1],
  ALL_NAV_ENTRIES[3],
  ALL_NAV_ENTRIES[5],
];

const TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/intelligence": "Intelligence",
  "/projects": "Projects",
  "/tasks": "Tasks",
  "/goals": "Goals",
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
