"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { SectionHeading } from "@/components/landing/section-heading";
import { LandingReveal } from "@/components/landing/landing-reveal";

// ============================================================
// NEXUS LANDING — FAQ
//
// Audit Item #23:
// Addresses critical user objections directly:
//   1. How is NEXUS different from Notion / Asana?
//   2. Does NEXUS replace my existing tools?
//   3. What can NEXUS access, and what does it read?
//   4. Does NEXUS train AI models on my data?
//   5. Can I disconnect a tool and delete my data?
//   6. What happens if NEXUS gets something wrong?
//   7. Does NEXUS read every email?
//   8. Can I see where an answer came from?
//
// Native <details>/<summary>: keyboard-friendly, works without JS.
// ============================================================

const FAQ_ITEMS = [
  {
    question: "How is NEXUS different from Notion, Asana or Linear?",
    answer:
      "NEXUS is not another task manager or workspace where you have to duplicate tasks and babysit databases. It is a contextual orchestration layer that sits above your existing tools to surface what is drifting, blocked or at risk—showing you what matters now, why it matters, and where it came from.",
  },
  {
    question: "Does NEXUS replace my existing tools?",
    answer:
      "No. NEXUS is designed to connect your tools, not replace them. You keep Gmail for email, Google Calendar for schedules, Notion for documentation, and GitHub or Linear for development. NEXUS continuously unifies their scattered signals into one working context.",
  },
  {
    question: "What can NEXUS access, and what does it read?",
    answer:
      "Only what you explicitly authorize. NEXUS reads operational metadata: deadlines, task statuses, calendar commitments, and relevant client validation threads. It never scrapes unshared private folders, irrelevant personal messages, or sensitive non-work data.",
  },
  {
    question: "Does NEXUS train AI models on my data?",
    answer:
      "Never. Your workspace data is never used to train public or proprietary models. Data is processed exclusively for transient inference, isolated in PostgreSQL with strict row-level security per workspace, and never shared across tenants.",
  },
  {
    question: "Can I disconnect a tool or delete my data?",
    answer:
      "Yes. You can revoke any connected tool in one click from your settings. If you choose to delete your account or workspace, all metadata, context graphs, and history are permanently erased with zero retention.",
  },
  {
    question: "What happens if NEXUS gets something wrong?",
    answer:
      "NEXUS is honest by construction. Every signal and recommendation declares an explicit confidence level (Confirmed, Likely, Uncertain, Unknown). When information conflicts or evidence is insufficient, NEXUS declines to guess. Consequential mutations always require your explicit review.",
  },
  {
    question: "Does NEXUS read every email in my inbox?",
    answer:
      "No. NEXUS only scans threads tied to your active projects and verified collaborators to detect deadlines, approvals, and blockers. It never archives your full email history or accesses unrelated personal messages.",
  },
  {
    question: "Can I see where an answer or recommendation came from?",
    answer:
      "Always. Every signal, insight, and next best action includes direct source citations—showing the exact tool, timestamp, and event it was computed from, so you never have to trust an unverified AI claim.",
  },
] as const;

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[800px]">
        <LandingReveal>
          <SectionHeading
            eyebrow="Questions & Objections"
            title="Questions, answered plainly."
            sub="Honest answers to the questions that matter before connecting your work tools."
          />
        </LandingReveal>

        <LandingReveal delay={90}>
          <div className="mt-12">
            {FAQ_ITEMS.map((item, index) => (
              <details
                key={item.question}
                className="nexus-faq-item group"
                open={openIndex === index}
              >
                <summary
                  onClick={(event) => {
                    event.preventDefault();
                    setOpenIndex((current) => (current === index ? null : index));
                  }}
                  className="flex cursor-pointer list-none items-start gap-4 py-5 transition-colors duration-150 ease-nexus hover:text-text-primary [&::-webkit-details-marker]:hidden"
                >
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
                    <NexusIcon icon={IconPlus} />
                  </span>
                </summary>
                <div className="nexus-faq-answer pb-6 pl-0 sm:pl-[38px]">
                  <p className="max-w-[62ch] text-small leading-[22px] text-text-secondary">
                    {item.answer}
                  </p>
                </div>
              </details>
            ))}
          </div>

          <p className="nexus-meta mt-8 text-center">
            Anything else? The same evidence and source citations live in the workspace, right next to the work they describe.
          </p>
        </LandingReveal>
      </div>
    </section>
  );
}
