import type { CSSProperties } from "react";
import { ArrowRight, Layers, Radar, Zap } from "lucide-react";
import { IntelligenceCTA } from "@/components/intelligence/intelligence-cta";
import { IntelligenceNetwork } from "@/components/intelligence/intelligence-network";

// ============================================================
// NEXUS INTELLIGENCE — HERO
//
// One deliberate viewport. The intelligence network runs behind
// everything; the statement, the two NEXUS actions and a single
// quiet line of product truth sit on top of it.
//
// Layer order (§8):
//   network canvas → atmospheric glow → scrim → content → nav
// The scrim is what guarantees the copy stays readable no matter
// what the field is doing behind it.
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
      {/* ---- Layer 1: the computational field ---- */}
      <div className="nexus-intel-network" aria-hidden="true">
        <IntelligenceNetwork className="nexus-intel-canvas" />
      </div>

      {/* ---- Layer 2: atmospheric glow ---- */}
      <div className="nexus-intel-atmosphere" aria-hidden="true" />

      {/* ---- Layer 3: the scrim that protects the copy ---- */}
      <div className="nexus-intel-scrim" aria-hidden="true" />

      <div className="pointer-events-none min-h-[16vh] flex-1 sm:min-h-[20vh]" />

      {/* ---- Layer 4: hero content ---- */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-col items-center px-5 text-center sm:px-6">
        <span
          className="nexus-intel-item inline-flex h-[26px] items-center gap-2 rounded-pill border border-border-default bg-bg-subtle/80 px-3 eyebrow text-text-secondary backdrop-blur-sm"
          style={delay(120)}
        >
          <span className="nexus-intel-eyebrow-dot" aria-hidden="true" />
          Nexus Intelligence
        </span>

        <h1
          className="nexus-intel-item mt-7 text-[38px] font-medium leading-[1.03] tracking-[-0.04em] text-text-primary sm:text-[56px] lg:text-[68px]"
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
          <IntelligenceCTA href="/signup" className="nexus-intel-sweep">
            Get started
            <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
          </IntelligenceCTA>
          <IntelligenceCTA
            href="#in-action"
            variant="secondary"
            className="nexus-intel-sweep"
          >
            See it in action
          </IntelligenceCTA>
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
                <span className="eyebrow text-text-tertiary">
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
