import { LandingReveal } from "@/components/landing/landing-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { IconChevronDown } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";

// ============================================================
// INTELLIGENCE FAQ & OBJECTIONS
// Addresses core user hesitations regarding deterministic
// intelligence vs LLMs, data privacy, and ranking mechanics.
// Uses native <details>/<summary> for zero JS dependency.
// ============================================================

const FAQS = [
  {
    q: "How is NEXUS Intelligence different from ChatGPT or generic AI assistants?",
    a: "NEXUS is not a chatbot or a generative text wrapper that invents answers. It is a deterministic operational engine that computes signals directly from your Postgres workspace records. It evaluates dependency graphs, overdue milestones, and project pacing using explicit ranking algorithms. It runs autonomously in 4ms with zero prompt engineering and zero hallucination risk.",
  },
  {
    q: "Is my private workspace data sent to third-party AI companies?",
    a: "No. Background signal extraction and priority ranking occur strictly within your secured workspace environment. Your tasks, project descriptions, client notes, and activity history are never exported to external LLM providers (like OpenAI or Anthropic) for background intelligence calculations.",
  },
  {
    q: "How does NEXUS rank and pick the “Next Best Action”?",
    a: "Every open task is evaluated across four transparent vectors: downstream blocker leverage (how many subsequent tasks are stuck waiting on it), target milestone urgency, days past due date, and project inactivity duration. The task with the highest leverage to unblock momentum is surfaced with full mathematical lineage attached.",
  },
  {
    q: "Do I have to write prompts, import documents, or maintain complex rules?",
    a: "Never. NEXUS reads the work you already do: tasks created, deadlines assigned, dependencies linked, and items completed. There is no second brain to maintain, no manual tagging required, and no chat prompt to write.",
  },
  {
    q: "What happens when a blocker is marked complete?",
    a: "The feedback loop closes instantly. The moment a dependency task is resolved, downstream blocked signals clear, goal pacing updates, and the next best action is re-evaluated in real time.",
  },
];

export function IntelligenceFaq() {
  return (
    <section id="faq" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 border-t border-border-subtle">
      <div className="mx-auto w-full max-w-page">
        <LandingReveal>
          <SectionHeading
            eyebrow="Truths & Objections"
            title={
              <>
                Clear answers on how the engine{" "}
                <span className="nexus-intel-accent">works</span>.
              </>
            }
            sub="No mystery algorithms or black-box claims. Everything about NEXUS Intelligence is auditable, deterministic, and private."
          />
        </LandingReveal>

        <LandingReveal delay={80}>
          <div className="mx-auto mt-12 w-full max-w-[760px] divide-y divide-border-subtle">
            {FAQS.map((item, index) => (
              <details
                key={index}
                className="group py-5 transition-colors focus-within:outline-hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-text-primary transition-colors hover:text-lavender [&::-webkit-details-marker]:hidden">
                  <span className="text-[16px] sm:text-[17px] font-semibold leading-snug">
                    {item.q}
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-surface text-text-secondary transition-transform duration-200 group-open:rotate-180 group-open:text-lavender">
                    <NexusIcon icon={IconChevronDown} px={16} />
                  </span>
                </summary>
                <div className="mt-3.5 pr-6 text-body text-text-secondary text-[14.5px] leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
