import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * NEXUS logo — LOCKED ASSET.
 *
 * The mark is the white interlaced architectural "N" delivered in the official
 * logo pack (design/NEXUS-V3-IMPLEMENTATION-BUNDLE/nexus-final-logo-pack).
 * It is rendered from the master PNG, never redrawn: no gradient, no chrome,
 * no rounded corners, no filled central gap, no geometry change.
 *
 * Sizes: 28px in the UI, 48px on auth screens.
 */
export function NexusLogo({
  size = 28,
  className,
  variant = "white",
  priority = false,
}: {
  size?: number;
  className?: string;
  variant?: "white" | "black";
  priority?: boolean;
}) {
  return (
    <Image
      src={variant === "black" ? "/logo/nexus-black.png" : "/logo/nexus.png"}
      alt="NEXUS"
      width={size}
      height={size}
      priority={priority}
      className={cn("select-none object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Symbol + wordmark lockup (Instrument Sans 700, tracking 0.08em, uppercase). */
export function NexusWordmark({
  size = 28,
  className,
  showText = true,
  priority = false,
}: {
  size?: number;
  className?: string;
  showText?: boolean;
  priority?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <NexusLogo size={size} priority={priority} />
      {showText ? (
        <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-text-primary">
          NEXUS
        </span>
      ) : null}
    </span>
  );
}
