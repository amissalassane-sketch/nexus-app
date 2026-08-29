import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * NEXUS LANDING — SECTION HEADING
 *
 * Shared rhythm for every landing section. The DESIGN AUDIT found the
 * public pages collapsing into one weight, so the ladder here is now
 * explicit and non-negotiable:
 *
 *   EYEBROW  mono · uppercase · tertiary   (the category)
 *   H2       display-lg · primary          (the claim)
 *   LEAD     lead · secondary              (the supporting line)
 *
 * `size` picks how loud the claim is:
 *   "section" (default) → 32px → 40px, the standard section voice
 *   "hero"              → 38px → 52px, reserved for the two or three
 *                         statements a page is actually about
 */
export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
  size = "section",
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "center" | "left";
  size?: "section" | "hero";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      <span className="nexus-eyebrow-pill">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-pill bg-lavender/70"
          aria-hidden="true"
        />
        {eyebrow}
      </span>

      <h2
        className={cn(
          "mt-5 text-text-primary",
          size === "hero"
            ? "max-w-[22ch] text-[38px] font-medium leading-[1.06] tracking-[-0.04em] sm:text-[52px]"
            : "max-w-[24ch] text-[32px] font-medium leading-[1.09] tracking-[-0.035em] sm:text-[40px]",
          align === "center" && "mx-auto"
        )}
      >
        {title}
      </h2>

      {sub ? (
        <p
          className={cn(
            "nexus-lead mt-5 max-w-[600px]",
            align === "center" && "mx-auto"
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
