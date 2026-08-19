/**
 * shadcn/ui convention expects the `cn` helper at `@/lib/utils`.
 * NEXUS keeps the single source of truth in `./cn` (no extra deps),
 * so this file just re-exports it for shadcn-compatible components.
 */
export { cn } from "./cn";
export type { ClassValue } from "./cn";
