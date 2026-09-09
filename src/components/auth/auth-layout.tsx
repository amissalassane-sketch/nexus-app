"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { NexusLogo } from "@/components/nexus-logo";

// ============================================================
// NEXUS — AUTHENTICATION LAYOUT
// The shared visual shell for every auth + onboarding screen.
// Animated dot-matrix canvas background, centred content,
// cinematic Framer Motion entrance, legal footer.
//
// The background is the SAME persistent environment across every
// auth page — the user progresses deeper into NEXUS, not from
// page to page.
// ============================================================

const NexusAuthBackground = dynamic(
  () =>
    import("@/components/ui/nexus-auth-background").then(
      (mod) => mod.NexusAuthBackground
    ),
  { ssr: false }
);

// Cinematic entrance: content rises softly from below with a
// gentle opacity sweep. Slow, intentional, premium.
const NEXUS_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const contentVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: NEXUS_EASE,
      staggerChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: { duration: 0.3, ease: NEXUS_EASE },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: NEXUS_EASE },
  },
};

export function AuthLayout({
  title,
  description,
  children,
  footer,
  aside,
  /** When the canvas should sweep in reverse (e.g. success state). */
  canvasVariant = "forward",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
  canvasVariant?: "forward" | "reverse";
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-black px-4 py-12">
      {/* Persistent animated environment */}
      <NexusAuthBackground variant={canvasVariant} />

      {/* Content layer — floats above the canvas */}
      <motion.div
        className="relative z-10 w-full max-w-[420px]"
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Logo */}
        <motion.div
          variants={itemVariants}
          className="mb-8 flex flex-col items-center text-center"
        >
          <Link
            href="/"
            aria-label="NEXUS home"
            className="group mb-6 inline-flex rounded-full outline-none"
          >
            <NexusLogo
              size={36}
              priority
              className="transition-opacity duration-300 ease-nexus group-hover:opacity-70"
            />
          </Link>

          {/* Title — large, cinematic, confident */}
          <h1 className="text-[2rem] font-bold leading-[1.15] tracking-tight text-white sm:text-[2.25rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-[36ch] text-[0.95rem] leading-relaxed text-white/50 font-light">
              {description}
            </p>
          ) : null}
        </motion.div>

        {/* Form / content area */}
        <motion.div variants={itemVariants}>{children}</motion.div>

        {/* Footer link */}
        {footer ? (
          <motion.div
            variants={itemVariants}
            className="mt-6 text-center text-xs text-white/40"
          >
            {footer}
          </motion.div>
        ) : null}
      </motion.div>

      {/* Optional aside below the card */}
      {aside ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="relative z-10 mt-10 w-full max-w-[420px]"
        >
          {aside}
        </motion.div>
      ) : null}

      {/* Tagline — always present, always quiet */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="relative z-10 mt-10 font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/25"
      >
        Operational intelligence for modern teams
      </motion.p>
    </main>
  );
}
