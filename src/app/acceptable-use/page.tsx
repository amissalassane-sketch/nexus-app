import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/legal-layout";
import { ACCEPTABLE_USE_TOC } from "@/components/legal/legal-data";
import {
  LegalSection,
  LegalSectionTitle,
  LegalParagraph,
  LegalList,
  LegalListItem,
  LegalCallout,
  LegalContactBox,
} from "@/components/legal/legal-ui";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description:
    "Review the operational rules, security standards, and AI safety practices expected from all NEXUS workspace users.",
  alternates: { canonical: "/acceptable-use" },
  openGraph: {
    url: "/acceptable-use",
    title: "Acceptable Use Policy · NEXUS",
    description: "Guidelines and prohibitions regarding platform security, responsible AI usage, and multi-tenant fair use.",
  },
};

export default function AcceptableUsePage() {
  return (
    <LegalDocumentLayout docId="acceptable-use" toc={ACCEPTABLE_USE_TOC}>
      {/* 1. Purpose */}
      <LegalSection id="1-purpose-scope">
        <LegalSectionTitle>1. Purpose & Scope of Application</LegalSectionTitle>
        <LegalParagraph>
          This Acceptable Use Policy (&ldquo;AUP&rdquo;) defines the rules and behavioral standards
          governing all users, administrators, and automated clients accessing the NEXUS intelligent
          workspace platform, services, APIs, and interfaces provided by{" "}
          <strong>[LEGAL ENTITY NAME]</strong> (&ldquo;NEXUS&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;,
          or &ldquo;our&rdquo;).
        </LegalParagraph>
        <LegalParagraph>
          By creating an account or accessing any workspace within NEXUS, you agree to comply with
          this Policy in its entirety. This Policy forms an integral part of the NEXUS Terms of
          Service.
        </LegalParagraph>
      </LegalSection>

      {/* 2. Infrastructure Security */}
      <LegalSection id="2-infrastructure-security">
        <LegalSectionTitle>2. System Security & Infrastructure Protection</LegalSectionTitle>
        <LegalParagraph>
          Maintaining a secure, high-integrity platform for all workspace tenants is our highest
          priority. You agree that you will not engage in any activity that compromises or threatens
          the security of NEXUS infrastructure:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Probing & Vulnerability Scanning:</strong> You must not probe, scan, or test the
            vulnerability of any NEXUS system, network, or authentication boundary without prior
            explicit written authorization.
          </LegalListItem>
          <LegalListItem>
            <strong>Circumvention of Access Controls:</strong> You must not attempt to bypass,
            circumvent, or defeat PostgreSQL Row-Level Security (RLS) policies, authentication
            mechanisms, token verifications, or workspace membership restrictions.
          </LegalListItem>
          <LegalListItem>
            <strong>Denial of Service (DoS / DDoS):</strong> You must not launch, facilitate, or
            participate in attacks that flood NEXUS endpoints, degrade system responsiveness, or
            exhaust database connection pools.
          </LegalListItem>
          <LegalListItem>
            <strong>Brute-Force & Credential Stuffing:</strong> You must not perform automated
            brute-force attacks against login forms, OTP verification endpoints, or password reset
            routes.
          </LegalListItem>
          <LegalListItem>
            <strong>Malicious Code Injection:</strong> You must not upload, inject, or transmit
            viruses, worms, trojans, ransomware, malicious scripts, or SQL injection payloads into
            workspace fields, titles, descriptions, or comments.
          </LegalListItem>
        </LegalList>
        <LegalCallout icon="warning" title="Zero-Tolerance Security Policy">
          Attempting to bypass tenant workspace isolation or extract another tenant&rsquo;s data is a
          severe breach of law and this Policy. Violations will result in immediate termination of
          access and criminal referral where appropriate.
        </LegalCallout>
      </LegalSection>

      {/* 3. Prohibited Activities */}
      <LegalSection id="3-prohibited-activities">
        <LegalSectionTitle>3. Prohibited Content & Malicious Activities</LegalSectionTitle>
        <LegalParagraph>
          You may not use NEXUS to store, create, distribute, coordinate, or transmit any content or
          activity that is unlawful, harmful, or fraudulent:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Illegal Conduct:</strong> Engaging in, facilitating, or promoting illegal
            activities, terrorism, violence, weapons proliferation, or illicit trade.
          </LegalListItem>
          <LegalListItem>
            <strong>Child Sexual Exploitation & Abuse:</strong> Any material depicting, promoting, or
            facilitating child sexual exploitation or abuse is strictly prohibited and will be reported
            to the National Center for Missing &amp; Exploited Children (NCMEC) and law enforcement
            authorities immediately.
          </LegalListItem>
          <LegalListItem>
            <strong>Harassment & Hate Speech:</strong> Engaging in systematic harassment, stalking,
            doxxing, defamation, or promoting violence or hatred against individuals or groups based on
            protected characteristics.
          </LegalListItem>
          <LegalListItem>
            <strong>Phishing & Social Engineering:</strong> Creating deceptive workspaces, tasks, or
            projects designed to harvest credentials, financial data, or sensitive personal identities
            under false pretenses.
          </LegalListItem>
          <LegalListItem>
            <strong>Intellectual Property Infringement:</strong> Storing or distributing proprietary
            assets, confidential trade secrets, or copyrighted material without legal authorization.
          </LegalListItem>
          <LegalListItem>
            <strong>Spam & Unsolicited Distribution:</strong> Using workspace invitation mechanisms to
            send unsolicited bulk communications, spam, or promotional campaigns.
          </LegalListItem>
        </LegalList>
      </LegalSection>

      {/* 4. Responsible AI Use */}
      <LegalSection id="4-responsible-ai-use">
        <LegalSectionTitle>4. Responsible Use of NEXUS Intelligence (AI)</LegalSectionTitle>
        <LegalParagraph>
          NEXUS Intelligence provides operational reasoning and agentic suggestions to assist teams.
          Users must interact with AI features in a responsible and ethical manner:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>No Prompt Injection or Jailbreaking:</strong> You must not craft adversarial
            prompts intended to bypass model safety filters, induce harmful outputs, or extract system
            instructions, underlying prompts, or internal tool schemas.
          </LegalListItem>
          <LegalListItem>
            <strong>No Malware or Exploit Generation:</strong> You must not use NEXUS Intelligence to
            generate exploit payloads, cyberattack plans, social engineering scripts, or automated
            disinformation.
          </LegalListItem>
          <LegalListItem>
            <strong>No Reverse Engineering of Model Weights:</strong> You must not use the AI
            features to scrape training data, build competing model datasets, or reverse engineer the
            underlying intelligence heuristics.
          </LegalListItem>
          <LegalListItem>
            <strong>Human Oversight:</strong> You acknowledge that AI proposals are assistive. You
            must not rely on AI outputs as the sole authority for safety-critical, medical, legal, or
            financial determinations.
          </LegalListItem>
        </LegalList>
        <LegalCallout icon="ai" title="Assistive Operational Guardrails">
          All agentic mutations proposed by NEXUS Intelligence (such as task deletions or status
          modifications) are gated by mandatory human confirmation. Attempting to bypass confirmation
          modals programmatically is strictly prohibited.
        </LegalCallout>
      </LegalSection>

      {/* 5. Workspace Fair Use */}
      <LegalSection id="5-workspace-fair-use">
        <LegalSectionTitle>5. Workspace Etiquette & Multi-Tenant Fair Use</LegalSectionTitle>
        <LegalParagraph>
          To maintain fair resource distribution across all organizations hosted on our multi-tenant
          platform:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Plan Limit Integrity:</strong> You must not attempt to manipulate database state
            or client scripts to circumvent plan limits (such as active task quotas, project caps, or
            member limits).
          </LegalListItem>
          <LegalListItem>
            <strong>Credential Integrity:</strong> Accounts are intended for individual human
            operators. You may not share user login credentials among multiple unverified individuals
            to circumvent seat-based plan allocations.
          </LegalListItem>
          <LegalListItem>
            <strong>Legitimate Membership:</strong> You may only invite collaborators who have
            expressly authorized you to add them to your workspace.
          </LegalListItem>
        </LegalList>
      </LegalSection>

      {/* 6. Scraping & Automation */}
      <LegalSection id="6-scraping-automation">
        <LegalSectionTitle>6. Automated Access, Rate Limiting & Scraping</LegalSectionTitle>
        <LegalParagraph>
          You may interact with NEXUS using supported web browsers or official client integrations.
          Uncontrolled automated access is restricted:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>No Abusive Web Scraping:</strong> You must not use automated spiders, scrapers, or
            headless browsers to extract platform assets, user profiles, or public content at speeds
            exceeding standard human interaction.
          </LegalListItem>
          <LegalListItem>
            <strong>Rate Limit Adherence:</strong> You must respect all HTTP rate limits, concurrency
            caps, and API cooldown headers. Attempting to rotate IP addresses or headers to bypass rate
            limits is considered malicious abuse.
          </LegalListItem>
        </LegalList>
      </LegalSection>

      {/* 7. Enforcement */}
      <LegalSection id="7-enforcement-penalties">
        <LegalSectionTitle>7. Violation Enforcement & Account Suspension</LegalSectionTitle>
        <LegalParagraph>
          We employ automated heuristics and manual reviews to identify suspicious activity. If a
          violation of this Policy is detected or reported, we reserve the right to take proportionate
          enforcement action without liability:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Formal Notice & Rectification:</strong> Issuing a formal warning requesting
            immediate remediation of the offending workspace content or automated script.
          </LegalListItem>
          <LegalListItem>
            <strong>Temporary Workspace Suspension:</strong> Temporarily disabling access to a
            workspace while an investigation into suspected security abuse is conducted.
          </LegalListItem>
          <LegalListItem>
            <strong>Permanent Account Termination:</strong> Permanently closing accounts and
            cancelling subscriptions for egregious or repeated breaches.
          </LegalListItem>
          <LegalListItem>
            <strong>Law Enforcement Referral:</strong> Reporting unlawful conduct, cybercrime, or child
            exploitation to competent law enforcement agencies.
          </LegalListItem>
        </LegalList>
      </LegalSection>

      {/* 8. Reporting */}
      <LegalSection id="8-reporting-violations">
        <LegalSectionTitle>8. Reporting Violations</LegalSectionTitle>
        <LegalParagraph>
          If you discover content or behavior within NEXUS that violates this Acceptable Use Policy,
          or if you identify a suspected security vulnerability, please report it immediately to our
          trust and security team at <strong>[LEGAL CONTACT EMAIL]</strong>.
        </LegalParagraph>
        <LegalParagraph>
          Please include relevant workspace identifiers, error logs, or evidence to assist our team in
          conducting a prompt, thorough investigation.
        </LegalParagraph>
      </LegalSection>

      {/* 9. Updates & Inquiries */}
      <LegalSection id="9-updates-inquiries">
        <LegalSectionTitle>9. Policy Updates & Contact</LegalSectionTitle>
        <LegalParagraph>
          We may revise this Acceptable Use Policy periodically to address emerging threats, regulatory
          mandates, or new platform features. Continued use of NEXUS following any revisions
          constitutes acceptance of the updated standards.
        </LegalParagraph>

        <LegalContactBox />
      </LegalSection>
    </LegalDocumentLayout>
  );
}
