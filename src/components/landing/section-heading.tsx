import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * NEXUS LANDING — SECTION HEADING
 * Shared rhythm for every landing section: mono eyebrow, one h2,
 * optional supporting line. `align` controls centering vs. left.
 */
export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "center" | "left";
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
      <span className="inline-flex h-[22px] items-center rounded-pill border border-border-default bg-bg-subtle px-2.5 font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
        {eyebrow}
      </span>
      <h2
        className={cn(
          "mt-4 max-w-[24ch] text-[30px] font-medium leading-[1.08] tracking-[-0.035em] text-text-primary sm:text-[40px]",
          align === "center" && "mx-auto"
        )}
      >
        {title}
      </h2>
      {sub ? (
        <p
          className={cn(
            "mt-4 max-w-[560px] text-body text-text-secondary sm:text-[15px] sm:leading-[24px]",
            align === "center" && "mx-auto"
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
