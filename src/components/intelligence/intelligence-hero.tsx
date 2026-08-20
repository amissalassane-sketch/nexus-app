import type { CSSProperties } from "react";
import { ArrowRight, Layers, Radar, Zap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { IntelligenceField } from "@/components/intelligence/intelligence-field";

// ============================================================
// NEXUS INTELLIGENCE — HERO
// One deliberate viewport: the mark forms out of signal points,
// the statement lands underneath it, two NEXUS actions, and a
// single quiet line of product truth along the bottom edge.
// ============================================================

const delay = (ms: number) => ({ "--intel-delay": `${ms}ms` }) as CSSProperties;

const FOOTNOTES = [
  {
    icon: Radar,
    label: "Signals detected",
    value: "Six signal types, computed from your workspace",
    align: "md:justify-start",
  },
  {
    icon: Layers,
    label: "Workspace context",
    value: "Tasks, projects, goals, deadlines, activity",
    align: "md:justify-center",
  },
  {
    icon: Zap,
    label: "Next action",
    value: "One recommendation, always explained",
    align: "md:justify-end",
  },
] as const;

export function IntelligenceHero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden pt-14">
      <IntelligenceField />

      {/* The mark occupies this space — it is deliberately empty. */}
      <div className="pointer-events-none min-h-[24vh] flex-1 sm:min-h-[32vh]" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-col items-center px-5 text-center sm:px-6">
        <span
          className="nexus-intel-item inline-flex h-[26px] items-center gap-2 rounded-pill border border-border-default bg-bg-subtle/80 px-3 font-mono text-mono uppercase tracking-[0.12em] text-text-secondary backdrop-blur-sm"
          style={delay(120)}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-lavender" aria-hidden="true" />
          Nexus Intelligence
        </span>

        <h1
          className="nexus-intel-item mt-7 text-[36px] font-medium leading-[1.03] tracking-[-0.04em] text-text-primary sm:text-[56px] lg:text-[66px]"
          style={delay(220)}
        >
          It reads <span className="nexus-intel-accent">the work</span>.
          <br />
          Not the chat.
        </h1>

        <p
          className="nexus-intel-item mt-6 max-w-[520px] text-balance text-body text-text-secondary sm:text-[15.5px] sm:leading-[25px]"
          style={delay(320)}
        >
          NEXUS analyzes the work already happening in your workspace and
          surfaces what is drifting, what is blocked, what is at risk — and
          what deserves your attention next.
        </p>

        <div
          className="nexus-intel-item mt-9 flex flex-wrap items-center justify-center gap-3"
          style={delay(420)}
        >
          <ButtonLink href="/signup" size="lg" className="nexus-intel-sweep">
            Get started
            <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
          </ButtonLink>
          <ButtonLink
            href="#in-action"
            variant="secondary"
            size="lg"
            className="nexus-intel-sweep bg-white/[0.02] backdrop-blur-sm"
          >
            See it in action
          </ButtonLink>
        </div>
      </div>

      <div className="min-h-[6vh] flex-1" />

      <div
        className="nexus-intel-item relative z-10 mt-8 border-t border-border-subtle sm:mt-10"
        style={delay(560)}
      >
        <ul className="mx-auto grid w-full max-w-[1120px] gap-x-8 gap-y-3 px-5 py-4 sm:gap-y-4 sm:py-5 sm:px-6 md:grid-cols-3">
          {FOOTNOTES.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.label}
                className={`flex items-center justify-center gap-2.5 ${item.align}`}
              >
                <Icon
                  size={13}
                  strokeWidth={1.75}
                  className="shrink-0 text-text-tertiary"
                  aria-hidden="true"
                />
                <span className="font-mono text-mono uppercase tracking-[0.08em] text-text-tertiary">
                  {item.label}
                </span>
                <span className="hidden text-small text-text-secondary lg:inline">
                  {item.value}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
