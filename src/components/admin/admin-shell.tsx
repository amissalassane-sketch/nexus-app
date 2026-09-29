"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_NAV, type AdminNavItem } from "@/lib/admin/nav";
import { cn } from "@/lib/cn";
import { AdminIcon } from "./admin-icons";
import { AdminStatusPill, type AdminTone } from "./status";
import { AdminCommandMenu } from "./admin-command-menu";

// ============================================================
// NEXUS ADMIN — SHELL
// ============================================================
// The chrome around every control plane screen. It owns exactly one
// piece of state: whether the mobile drawer is open. Everything it
// displays is decided server-side and handed to it as props, because a
// shell that fetches its own data is how an admin surface ends up with
// two sources of truth.
//
// Responsive behaviour, all three real:
//   ≥1024px  persistent sidebar with labels
//   768–1023 persistent sidebar, icon rail (labels hidden by CSS, still
//            present for assistive technology and still focusable)
//   <768px   drawer, opened from the top bar, closed by Escape, the
//            scrim, or the link you followed
//
// Geometry and surface language are the product's: pure-black chrome, 248px
// rail, 56px top bar, hairline borders, 32px navigation rows on a pointer
// device / 40px in the touch drawer. Volt Lime appears in exactly two
// places — the live status dot and the active rail — because on an
// operator surface the accent is state, not decoration.
// ============================================================

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-accent";

function isActive(currentPath: string, href: string): boolean {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

/**
 * `variant="responsive"` renders ONE row that is compact below `lg` and
 * labelled from `lg` up, purely through CSS. Rendering two variants and
 * hiding one would place every link in the accessibility tree twice,
 * which is exactly what makes a sidebar unusable with a screen reader.
 */
type NavVariant = "responsive" | "full";

function NavRow({
  item,
  currentPath,
  variant,
  onNavigate,
}: {
  item: AdminNavItem;
  currentPath: string;
  variant: NavVariant;
  onNavigate?: () => void;
}) {
  const responsive = variant === "responsive";
  const labelClass = responsive ? "hidden lg:inline" : undefined;
  const rowShape = responsive
    ? "justify-center px-0 lg:justify-start lg:px-2.5"
    : "px-2.5";

  // Planned entries are not links. A control plane that links to a route
  // it has not built trains the operator to expect 404s.
  //
  // Accessible "coming soon" state: the row announces itself as disabled
  // (aria-disabled) and the reason is in the accessibility tree itself —
  // an sr-only note, not only in the `title` tooltip, which keyboard and
  // screen-reader users do not reliably receive. The visual "soon" badge
  // and the hover tooltip stay as they are.
  if (item.status !== "ready") {
    return (
      <span
        aria-disabled="true"
        title={`${item.label} — coming soon: ${item.note ?? "not available yet"}`}
        className={cn(
          "flex h-10 w-full cursor-not-allowed items-center gap-3 rounded-control text-body text-admin-text-3 md:h-8",
          rowShape
        )}
      >
        <AdminIcon name={item.icon} size="nav" />
        <span className={cn("min-w-0 flex-1 truncate", labelClass)}>
          {item.label}
        </span>
        <span
          className={cn(
            "shrink-0 items-center rounded-xs border border-admin-border px-1.5 py-px mono-token text-admin-text-3",
            labelClass
          )}
        >
          soon
        </span>
        <span className="sr-only">
          {`Coming soon — ${item.note ?? "not available yet"}`}
        </span>
      </span>
    );
  }

  const active = isActive(currentPath, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={responsive ? item.label : undefined}
      className={cn(
        "group relative flex h-10 w-full items-center gap-3 rounded-control text-body transition-colors duration-[120ms] md:h-8",
        FOCUS,
        rowShape,
        active
          ? "bg-admin-surface-2 font-medium text-admin-text"
          : "text-admin-text-2 hover:bg-admin-surface hover:text-admin-text active:bg-admin-surface-2"
      )}
    >
      {/* Volt Lime is reserved for the active marker: the only place in
          the shell where the accent is allowed to appear. */}
      {active ? (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-admin-accent"
        />
      ) : null}
      <AdminIcon
        name={item.icon}
        size="nav"
        className={active ? "text-admin-accent" : undefined}
      />
      <span className={cn("min-w-0 flex-1 truncate", labelClass)}>
        {item.label}
      </span>
    </Link>
  );
}

function NavBody({
  currentPath,
  variant,
  onNavigate,
}: {
  currentPath: string;
  variant: NavVariant;
  onNavigate?: () => void;
}) {
  const responsive = variant === "responsive";

  return (
    <nav
      aria-label="NEXUS Admin sections"
      className={cn(
        "flex-1 overflow-y-auto py-3",
        responsive ? "px-1.5 lg:px-2.5" : "px-2.5"
      )}
    >
      {ADMIN_NAV.map((group) => (
        <div key={group.id} className="mb-4 last:mb-0">
          {/* Group heading, or a hairline when the rail is too narrow for
              words. In the compact state the heading is hidden, because
              the rows themselves carry the labels. Sans, never mono: this
              is a human label, not a machine token. */}
          <p
            className={cn(
              "eyebrow mb-1.5 text-admin-text-3",
              responsive ? "hidden px-2.5 lg:block" : "px-2.5"
            )}
          >
            {group.label}
          </p>
          {responsive ? (
            <div
              aria-hidden="true"
              className="mx-auto mb-2 h-px w-6 bg-admin-border lg:hidden"
            />
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavRow
                  item={item}
                  currentPath={currentPath}
                  variant={variant}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function BrandBlock() {
  return (
    <div className="flex h-14 shrink-0 items-center justify-center gap-2.5 border-b border-admin-border px-0 md:px-0 lg:justify-start lg:px-4">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control border border-admin-accent-border bg-admin-accent-bg mono-meta font-semibold text-admin-accent"
      >
        N
      </span>
      <span className="hidden min-w-0 lg:block">
        <span className="block truncate text-body-medium font-semibold text-admin-text">
          NEXUS Admin
        </span>
        <span className="block truncate mono-token text-admin-text-3">
          Control plane
        </span>
      </span>
    </div>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    // Invalidate session cookies via POST /api/auth/signout
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-control border border-admin-border bg-admin-surface px-2.5 text-small text-admin-text-2 transition-colors duration-[120ms] hover:border-admin-border-strong hover:text-admin-text disabled:opacity-50 sm:h-8",
        FOCUS
      )}
    >
      <AdminIcon name="logout" size="action" />
      <span className="hidden sm:inline">{pending ? "Signing out" : "Sign out"}</span>
    </button>
  );
}

export function AdminShell({
  role,
  email,
  platformLabel,
  platformTone,
  lastUpdated,
  children,
}: {
  role: string;
  email: string | null;
  platformLabel: string;
  platformTone: AdminTone;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // The drawer remembers the route it was opened on instead of holding a
  // boolean. Following a link changes the route, so the drawer closes
  // itself by derivation — no effect that fights the navigation, and no
  // setState racing a render.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const drawerOpen = drawerPath !== null && drawerPath === pathname;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const open = useCallback(() => setDrawerPath(pathname), [pathname]);

  const close = useCallback(() => {
    setDrawerPath((wasOpen) => {
      if (wasOpen !== null) triggerRef.current?.focus();
      return null;
    });
  }, []);

  // Escape closes the drawer; moving focus into it on open keeps the
  // keyboard where the operator expects it to be.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, close]);

  const identity = (
    <div className="shrink-0 border-t border-admin-border px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <p className="mono-token text-admin-text-3">Signed in</p>
      <p className="mt-1 truncate text-small text-admin-text">
        {email ?? "Platform operator"}
      </p>
      <p className="mt-0.5 truncate mono-token text-admin-accent">{role}</p>
    </div>
  );

  return (
    <div
      data-dashboard-root="true"
      className="admin-root flex h-dvh overflow-hidden bg-admin-base text-admin-text"
    >
      {/* Desktop / tablet rail. One DOM tree: the compact state is CSS. */}
      <aside className="sticky top-0 hidden h-dvh w-[64px] shrink-0 flex-col border-r border-admin-border bg-admin-sidebar md:flex lg:w-[248px]">
        <BrandBlock />
        <NavBody currentPath={pathname} variant="responsive" />
        <div className="hidden lg:block">{identity}</div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-admin-border bg-admin-base px-4 sm:px-6">
          <button
            ref={triggerRef}
            type="button"
            onClick={open}
            aria-label="Open NEXUS Admin navigation"
            aria-expanded={drawerOpen}
            aria-controls="nexus-admin-drawer"
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-admin-border bg-admin-surface text-admin-text-2 transition-colors duration-[120ms] hover:border-admin-border-strong hover:text-admin-text md:hidden",
              FOCUS
            )}
          >
            <AdminIcon name="menu" size="toolbar" />
          </button>

          <button
            type="button"
            onClick={() => setCommandMenuOpen(true)}
            aria-label="Search admin sections (Cmd+K)"
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-admin-border bg-admin-surface text-admin-text-2 transition-colors duration-[120ms] hover:border-admin-border-strong hover:text-admin-text sm:hidden",
              FOCUS
            )}
          >
            <AdminIcon name="search" size="toolbar" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate mono-token text-admin-text-3">NEXUS Admin</p>
            <p className="truncate text-small text-admin-text">Control plane</p>
          </div>

          {/* Global Quick Search Button (Ctrl/Cmd + K) */}
          <button
            type="button"
            onClick={() => setCommandMenuOpen(true)}
            aria-label="Search admin sections (Cmd+K)"
            className={cn(
              "hidden h-8 items-center gap-2.5 rounded-control border border-admin-border bg-admin-surface px-3 text-small text-admin-text-2 transition-colors duration-[120ms] hover:border-admin-border-strong hover:text-admin-text sm:inline-flex",
              FOCUS
            )}
          >
            <AdminIcon name="search" size="action" className="text-admin-text-3" />
            <span className="hidden md:inline">Jump to…</span>
            <kbd className="rounded-xs border border-admin-border bg-admin-surface-2 px-1.5 py-0.5 mono-token text-admin-text-3">
              ⌘K
            </kbd>
          </button>

          <AdminStatusPill tone={platformTone} className="hidden sm:inline-flex">
            {platformLabel}
          </AdminStatusPill>

          <span className="hidden shrink-0 lg:inline mono-meta text-admin-text-3">
            {lastUpdated}
          </span>

          <SignOutButton />
        </header>

        <main
          id="admin-content"
          className="admin-canvas min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        >
          {children}
        </main>
      </div>

      <AdminCommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
      />

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden="true"
            onClick={close}
            className="absolute inset-0 bg-black/60 motion-safe:animate-[fade-in_140ms_ease-out_both]"
          />
          <div
            id="nexus-admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="NEXUS Admin navigation"
            className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-admin-border bg-admin-sidebar shadow-overlay motion-safe:animate-[list-in_180ms_ease-out_both]"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-admin-border pl-4 pr-2">
              <span className="text-body-medium font-semibold text-admin-text">
                NEXUS Admin
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close navigation"
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-control text-admin-text-2 transition-colors duration-[120ms] hover:bg-admin-surface-2 hover:text-admin-text",
                  FOCUS
                )}
              >
                <AdminIcon name="close" size="toolbar" />
              </button>
            </div>
            <NavBody currentPath={pathname} variant="full" onNavigate={close} />
            {identity}
          </div>
        </div>
      ) : null}
    </div>
  );
}
