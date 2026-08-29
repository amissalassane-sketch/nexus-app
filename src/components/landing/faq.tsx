import { Plus } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — FAQ
//
// Native <details>/<summary>: accessible, keyboard-friendly, works
// without JavaScript.
//
// DESIGN AUDIT: the questions were the same size as the answers, so
// the list had no structure to scan. Each row is now numbered and
// set one step above its answer; the separator is a hairline, and
// opening is a 220ms rise (disabled under reduced motion).
//
// Every answer is factual and tied to code in this repository.
// ============================================================

const FAQ_ITEMS = [
  {
    question: "Who owns my data?",
    answer:
      "You do. NEXUS runs on your own Supabase Postgres database: every workspace is isolated with row-level security, and plan limits are enforced server-side. Fonts are self-hosted and there are no third-party trackers.",
  },
  {
    question: "Can I use NEXUS without AI?",
    answer:
      "Yes. Signals come from a deterministic engine that reads your real tasks, projects, goals and activity. Optional model enrichment only rephrases a signal — when it is unconfigured, timed out or unavailable, NEXUS falls back to the deterministic result and says so.",
  },
  {
    question: "How does NEXUS Intelligence work?",
    answer:
      "It reads the workspace and flags overdue work, blocked tasks, projects without a next action and goals at risk, tracks weekly momentum, and computes a single next best action. Every signal names the evidence it was computed from — nothing is invented.",
  },
  {
    question: "What does Cmd + K do?",
    answer:
      "Command K opens the palette from anywhere in the app: navigate, create, or search real tasks, projects and goals without leaving the keyboard.",
  },
  {
    question: "Is NEXUS really free?",
    answer:
      "Yes — $0 forever, with one workspace, two projects, one hundred active tasks, three goals and one member. No card required. Pro and Business raise those limits and add advanced analytics, collaboration and granular permissions.",
  },
] as const;

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[800px]">
        <LandingReveal>
          <SectionHeading eyebrow="FAQ" title="Questions, answered plainly." />
        </LandingReveal>

        <LandingReveal delay={90}>
          <div className="mt-12">
            {FAQ_ITEMS.map((item, index) => (
              <details key={item.question} className="nexus-faq-item group">
                <summary className="flex cursor-pointer list-none items-start gap-4 py-5 transition-colors duration-150 ease-nexus hover:text-text-primary [&::-webkit-details-marker]:hidden">
                  <span className="nexus-meta-strong mt-[3px] shrink-0 tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="min-w-0 flex-1 text-[17px] font-medium leading-[26px] tracking-[-0.017em] text-text-primary">
                    {item.question}
                  </h3>
                  <span
                    className="mt-[3px] flex h-7 w-7 shrink-0 items-center justify-center rounded-pill border border-border-default text-text-secondary transition-transform duration-200 ease-nexus group-open:rotate-45"
                    aria-hidden="true"
                  >
                    <Plus size={14} strokeWidth={1.75} />
                  </span>
                </summary>
                <div className="nexus-faq-answer pb-6 pl-0 sm:pl-[38px]">
                  <p className="max-w-[62ch] text-small leading-[21px] text-text-secondary">
                    {item.answer}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
