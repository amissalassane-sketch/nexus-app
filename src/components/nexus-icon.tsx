// ============================================================
// NEXUS — ICON LANGUAGE
// ============================================================
// One icon library: @tabler/icons-react. No Lucide in migrated zones,
// no Heroicons, no Font Awesome, no hand-downloaded SVG.
//
// This wrapper exists for three reasons:
//   1. It fixes the visual language in one place — 24×24 grid, outline,
//      stroke 1.75, currentColor — so a NEXUS surface cannot drift into
//      mixed stroke weights.
//   2. It fixes the size scale: navigation 18, toolbar 18, compact
//      actions 16, empty states 24–32. The rare inline-text glyph that
//      cannot take the scale uses the `px` escape with a comment.
//   3. It makes the accessibility default correct: an icon is decorative
//      (aria-hidden) unless the caller names it, in which case it becomes
//      role="img" with a real label.
//
// Usage: import the glyph directly (tree-shakable) and render it here:
//
//   import { IconBell } from "@tabler/icons-react";
//   import { NexusIcon } from "@/components/nexus-icon";
//   <NexusIcon icon={IconBell} size="toolbar" />
//
// When a glyph must be selected dynamically, use an explicit map of
// component references (see the navigation model) — never a global or
// dynamic import of the library.
// ============================================================

import type { TablerIcon } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

/** The four sizes of the NEXUS icon language. Numbers, not vibes. */
export const NEXUS_ICON_SIZES = {
  /** Sidebar entries, mobile tab bar, section titles. */
  nav: 18,
  /** Topbar buttons, page toolbars, palette toggles. */
  toolbar: 18,
  /** Dropdown items, row actions, inline affordances. */
  action: 16,
  /** Empty states. */
  state: 24,
  /** Empty states that carry the screen. */
  stateLg: 32,
} as const;

export type NexusIconSize = keyof typeof NEXUS_ICON_SIZES;

export type NexusIconProps = {
  /** The Tabler glyph, imported directly at the call site. */
  icon: TablerIcon;
  size?: NexusIconSize;
  /** Exact pixel size, for the rare inline-text glyph the scale cannot serve. */
  px?: number;
  /** Accessible name. Omit it for a decorative icon — it is then hidden
   *  from assistive technology, which is the correct default. */
  label?: string;
  className?: string;
  /** Stroke width. 1.75 is the system default; only override it to make
   *  a single large empty-state icon feel lighter. */
  stroke?: number;
};

export function NexusIcon({
  icon: Component,
  size = "action",
  px,
  label,
  className,
  stroke = 1.75,
}: NexusIconProps) {
  return (
    <Component
      size={px ?? NEXUS_ICON_SIZES[size]}
      stroke={stroke}
      color="currentColor"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn("shrink-0", className)}
    />
  );
}
