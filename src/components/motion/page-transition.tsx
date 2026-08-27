"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "./use-reduced-motion";

export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevPathname = useRef(pathname);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevPathname.current === pathname) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayChildren(children);
      return;
    }

    if (reduced) {
      prevPathname.current = pathname;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayChildren(children);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTransitioning(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      prevPathname.current = pathname;
      setDisplayChildren(children);
      setIsTransitioning(false);
    }, 120);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pathname, children, reduced]);

  return (
    <div
      className={cn(
        "min-h-0 will-change-transform",
        isTransitioning
          ? "animate-[fade-out_120ms_var(--ease-nexus)_both]"
          : "animate-[page-enter_380ms_var(--ease-nexus)_both]",
        className
      )}
      data-transitioning={isTransitioning ? "true" : undefined}
    >
      {displayChildren}
    </div>
  );
}
