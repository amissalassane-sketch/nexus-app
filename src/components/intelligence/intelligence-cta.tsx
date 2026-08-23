"use client";

import { useRef, type ComponentProps } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { signalIntelligenceIntent } from "@/components/intelligence/intelligence-network";

// ============================================================
// NEXUS INTELLIGENCE — CTA
//
// The existing NEXUS pill button, wrapped with one behaviour: on
// hover (or keyboard focus) it tells the network where the user's
// attention is, and the field answers locally for ~500ms.
//
// The button itself is unchanged NEXUS: white pill / black text for
// the primary action, glass + hairline border for the secondary.
// ============================================================

type IntelligenceCtaProps = Omit<ComponentProps<typeof ButtonLink>, "size"> & {
  size?: ComponentProps<typeof ButtonLink>["size"];
};

export function IntelligenceCTA({
  variant = "primary",
  size = "lg",
  className,
  children,
  ...props
}: IntelligenceCtaProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  // One activation per pointer entry — hovering back and forth must not
  // let the user pump the field into a light show.
  const armed = useRef(true);

  const notify = () => {
    if (!armed.current) return;
    armed.current = false;
    signalIntelligenceIntent(ref.current);
    window.setTimeout(() => {
      armed.current = true;
    }, 900);
  };

  return (
    <ButtonLink
      ref={ref}
      variant={variant}
      size={size}
      onPointerEnter={notify}
      onFocus={notify}
      className={cn(
        "nexus-intel-cta",
        variant === "primary" && "nexus-intel-cta-primary",
        variant === "secondary" && "nexus-intel-cta-secondary",
        className
      )}
      {...props}
    >
      {children}
    </ButtonLink>
  );
}
