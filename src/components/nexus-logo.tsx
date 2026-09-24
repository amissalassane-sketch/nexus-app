import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * NEXUS logo — LOCKED ASSET.
 *
 * The mark is the interlaced architectural "N" delivered in the official
 * logo pack (design/NEXUS-V3-IMPLEMENTATION-BUNDLE/nexus-final-logo-pack).
 * It is rendered from the master PNGs:
 *   - /logo/nexus-black.png in Light Mode
 *   - /logo/nexus.png in Dark Mode
 *
 * When variant="auto" (default), it adapts automatically to current theme
 * using CSS (dark:hidden / hidden dark:block) so there is never an invisible
 * white-on-white or black-on-black mark.
 */
export function NexusLogo({
  size = 28,
  className,
  variant = "auto",
  priority = false,
}: {
  size?: number;
  className?: string;
  variant?: "white" | "black" | "auto";
  priority?: boolean;
}) {
  if (variant === "black") {
    return (
      <Image
        src="/logo/nexus-black.png"
        alt="NEXUS"
        width={size}
        height={size}
        priority={priority}
        className={cn("select-none object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  if (variant === "white") {
    return (
      <Image
        src="/logo/nexus.png"
        alt="NEXUS"
        width={size}
        height={size}
        priority={priority}
        className={cn("select-none object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  // Auto theme-aware: dark logo on light background, white logo on dark background
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center relative", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo/nexus-black.png"
        alt="NEXUS"
        width={size}
        height={size}
        priority={priority}
        className="select-none object-contain dark:hidden"
        style={{ width: size, height: size }}
      />
      <Image
        src="/logo/nexus.png"
        alt="NEXUS"
        width={size}
        height={size}
        priority={priority}
        className="select-none object-contain hidden dark:block"
        style={{ width: size, height: size }}
      />
    </span>
  );
}

/** Symbol + wordmark lockup (Instrument Sans 700, tracking 0.08em, uppercase). */
export function NexusWordmark({
  size = 28,
  className,
  showText = true,
  priority = false,
  variant = "auto",
}: {
  size?: number;
  className?: string;
  showText?: boolean;
  priority?: boolean;
  variant?: "white" | "black" | "auto";
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <NexusLogo size={size} priority={priority} variant={variant} />
      {showText ? (
        <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-text-primary">
          NEXUS
        </span>
      ) : null}
    </span>
  );
}
