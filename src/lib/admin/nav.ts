// ============================================================
// NEXUS ADMIN — NAVIGATION MODEL
// ============================================================
// One source of truth for the control plane's structure. Icons are
// referenced by key, not by component, so this module stays plain data
// and can be read from a server component without pulling React in.
//
// `status` is the honest part: an entry marked "planned" is rendered as a
// muted, non-navigable row with its reason visible. The alternative —
// linking to a page that does not exist, or hiding the entry until it is
// ready — both make the control plane lie about its own shape.
// ============================================================

/** Keys into the Tabler icon map in components/admin/admin-icons.tsx. */
export type AdminIconName =
  | "gauge"
  | "users"
  | "building"
  | "sitemap"
  | "chart"
  | "creditCard"
  | "wallet"
  | "invoice"
  | "activity"
  | "sparkles"
  | "server"
  | "bug"
  | "alert"
  | "shield"
  | "sessions"
  | "history"
  | "flag"
  | "plug"
  | "settings";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: AdminIconName;
  status: "ready" | "planned";
  /** Visible reason an entry is not usable yet. Required when planned. */
  note?: string;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "control",
    label: "Control",
    items: [
      {
        label: "Overview",
        href: "/admin/overview",
        icon: "gauge",
        status: "ready",
      },
    ],
  },
  {
    id: "business",
    label: "Business",
    items: [
      {
        label: "Users",
        href: "/admin/users",
        icon: "users",
        status: "ready",
      },
      {
        label: "Workspaces",
        href: "/admin/workspaces",
        icon: "building",
        status: "ready",
      },
      {
        label: "Organizations",
        href: "/admin/organizations",
        icon: "sitemap",
        status: "planned",
        note: "No organization concept exists in the schema yet.",
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      {
        label: "Revenue",
        href: "/admin/revenue",
        icon: "chart",
        status: "planned",
        note: "No payment provider is connected — there is no revenue to show.",
      },
      {
        label: "Subscriptions",
        href: "/admin/subscriptions",
        icon: "creditCard",
        status: "planned",
        note: "workspace_subscriptions exists but no provider writes to it.",
      },
      {
        label: "Payments",
        href: "/admin/payments",
        icon: "wallet",
        status: "planned",
        note: "No payment provider is connected.",
      },
      {
        label: "Invoices",
        href: "/admin/invoices",
        icon: "invoice",
        status: "planned",
        note: "No invoice storage exists.",
      },
    ],
  },
  {
    id: "product",
    label: "Product",
    items: [
      {
        label: "Usage",
        href: "/admin/usage",
        icon: "activity",
        status: "planned",
        note: "Counts are on the Overview; a breakdown needs a time series (PR 3).",
      },
      {
        label: "Activity",
        href: "/admin/activity",
        icon: "history",
        status: "ready",
      },
      {
        label: "Intelligence",
        href: "/admin/intelligence",
        icon: "sparkles",
        status: "planned",
        note: "Signal and mission tables exist; the inspector lands in PR 5.",
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        label: "System Health",
        href: "/admin/system/health",
        icon: "server",
        status: "planned",
        note: "The health probes already run on the Overview; a dedicated page lands in PR 4.",
      },
      {
        label: "Errors",
        href: "/admin/system/errors",
        icon: "bug",
        status: "planned",
        note: "No error table exists yet — errors are server logs only (PR 4).",
      },
      {
        label: "Incidents",
        href: "/admin/system/incidents",
        icon: "alert",
        status: "planned",
        note: "No incident model exists yet (PR 4).",
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      {
        label: "Security",
        href: "/admin/security",
        icon: "shield",
        status: "ready",
      },
      {
        label: "Sessions",
        href: "/admin/sessions",
        icon: "sessions",
        status: "planned",
        note: "GoTrue sessions are not readable without the service key.",
      },
      {
        label: "Audit Log",
        href: "/admin/audit-log",
        icon: "history",
        status: "ready",
      },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      {
        label: "Feature Flags",
        href: "/admin/feature-flags",
        icon: "flag",
        status: "planned",
        note: "No flag system exists yet (PR 5).",
      },
      {
        label: "Integrations",
        href: "/admin/integrations",
        icon: "plug",
        status: "planned",
        note: "The catalogue is code-side only; no per-tenant state to inspect.",
      },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: "settings",
        status: "planned",
        note: "Platform admin management lands in PR 5.",
      },
    ],
  },
];

export const ADMIN_HOME = "/admin/overview";

/** Flat list of every route the shell actually renders today. Used by the
 *  tests to prove no nav entry points at a page that does not exist. */
export function readyAdminRoutes(): string[] {
  return ADMIN_NAV.flatMap((group) =>
    group.items.filter((item) => item.status === "ready").map((item) => item.href)
  );
}
