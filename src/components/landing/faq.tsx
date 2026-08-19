import { ChevronDown } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — FAQ
// Native <details>/<summary> (accessible, keyboard-friendly, no
// JavaScript). Every answer is factual and tied to the product.
// ============================================================

const FAQ_ITEMS = [
  {
    question: "Is NEXUS free?",
    answer:
      "Yes. The Free plan includes one workspace, two projects, one hundred active tasks and three goals — no card required. PRO and TEAM pricing will be announced when a payment provider is connected; nothing is ever charged before that.",
  },
  {
    question: "How does NEXUS Intelligence work?",
    answer:
      "It is a deterministic engine that analyzes your real tasks, projects and goals. It flags overdue work, blocked tasks, projects without a next action and goals at risk, tracks weekly momentum, and computes a single next best action. Every signal explains its own reason — nothing is invented.",
  },
  {
    question: "What is the Goal → Project → Task → Activity model?",
    answer:
      "It is the core of NEXUS. A goal sets the direction, a project moves it forward, a task is the next concrete step, and activity records what actually happened. Every level is linked to the others, so progress is measured from real work.",
  },
  {
    question: "Where is my data stored?",
    answer:
      "In your Supabase project's Postgres database. Each workspace is isolated with row-level security, and every plan limit is enforced server-side by the database.",
  },
  {
    question: "Can I use NEXUS from the keyboard?",
    answer:
      "Yes. Command K opens the command palette from anywhere — navigate, create, or search real tasks, projects and goals without leaving the keyboard.",
  },
] as const;

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[760px]">
        <LandingReveal>
          <SectionHeading eyebrow="FAQ" title="Questions, answered plainly." />
        </LandingReveal>

        <LandingReveal delay={90}>
          <div className="mt-10 border-t border-border-subtle">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group border-b border-border-subtle">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-h3 text-text-primary transition-colors duration-150 ease-nexus hover:text-text-secondary [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDown
                    size={15}
                    strokeWidth={1.75}
                    className="shrink-0 text-text-tertiary transition-transform duration-200 ease-nexus group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="pb-6 pr-8 text-small leading-relaxed text-text-secondary">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
