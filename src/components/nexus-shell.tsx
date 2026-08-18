"use client";

import { useState, type ReactNode } from "react";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

// ============================================================
// NEXUS V3 — GLOBAL SHELL
// Fixed 56px top bar + 220px transparent sidebar + dense content column.
// Page content owns its own PageHeader (title, counter, Create pill).
// `title` / `subtitle` remain supported for context and page metadata.
// ============================================================

export function NexusShell({
  title,
  subtitle,
  userName,
  username,
  children,
}: {
  title: string;
  subtitle?: string;
  userName: string;
  username?: string;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <TopBar
        userName={userName}
        username={username}
        pageTitle={title}
        onOpenNav={() => setNavOpen(true)}
      />

      <Sidebar userName={userName} username={username} />

      <MobileNav
        open={navOpen}
        onClose={() => setNavOpen(false)}
        userName={userName}
        username={username}
      />

      <main className="mt-14 px-4 pb-16 pt-6 sm:px-6 md:ml-[220px] md:px-8">
        <div className="mx-auto w-full max-w-[1240px]">
          {subtitle ? <span className="sr-only">{subtitle}</span> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
