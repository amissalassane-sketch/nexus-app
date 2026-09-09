import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/legal-layout";
import { TERMS_TOC } from "@/components/legal/legal-data";
import {
  LegalSection,
  LegalSectionTitle,
  LegalSubsectionTitle,
  LegalParagraph,
  LegalList,
  LegalListItem,
  LegalCallout,
  LegalContactBox,
} from "@/components/legal/legal-ui";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the terms, conditions, and operational policies governing your access to and use of NEXUS workspaces and services.",
  alternates: { canonical: "/terms" },
  openGraph: {
    url: "/terms",
    title: "Terms of Service · NEXUS",
    description: "The contractual terms governing access and use of the NEXUS intelligent workspace.",
  },
};

export default function TermsPage() {
  return (
    <LegalDocumentLayout docId="terms" toc={TERMS_TOC}>
      {/* 1. Introduction */}
      <LegalSection id="1-introduction-acceptance">
        <LegalSectionTitle>1. Introduction & Acceptance of Terms</LegalSectionTitle>
        <LegalParagraph>
          Welcome to NEXUS. These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding
          agreement between you (&ldquo;User&rdquo;, &ldquo;you&rdquo;, or &ldquo;your&rdquo;) and{" "}
          <strong>[LEGAL ENTITY NAME]</strong> (&ldquo;NEXUS&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;,
          or &ldquo;our&rdquo;), governing your access to and use of the NEXUS intelligent workspace
          application, APIs, website, and related services (collectively, the &ldquo;Service&rdquo;).
        </LegalParagraph>
        <LegalParagraph>
          By creating an account, accessing, or using the Service, you acknowledge that you have
          read, understood, and agree to be bound by these Terms and our Privacy Policy. If you are
          entering into these Terms on behalf of a company, organization, or other legal entity, you
          represent that you have the authority to bind such entity to these Terms. If you do not
          agree to these Terms, you must not access or use NEXUS.
        </LegalParagraph>
      </LegalSection>

      {/* 2. Eligibility & Account Registration */}
      <LegalSection id="2-eligibility-account">
        <LegalSectionTitle>2. Eligibility & Account Registration</LegalSectionTitle>
        <LegalParagraph>
          To access NEXUS, you must register for an account. By registering, you agree to:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Eligibility:</strong> Be at least 18 years of age or the age of legal majority in
            your jurisdiction.
          </LegalListItem>
          <LegalListItem>
            <strong>Accurate Information:</strong> Provide accurate, current, and complete account
            information, including a valid email address.
          </LegalListItem>
          <LegalListItem>
            <strong>Credential Security:</strong> Maintain the confidentiality and security of your
            authentication credentials, password, and one-time verification tokens (OTP).
          </LegalListItem>
          <LegalListItem>
            <strong>Account Accountability:</strong> Assume full responsibility for all activities,
            mutations, and operations occurring under your account credentials.
          </LegalListItem>
        </LegalList>
        <LegalParagraph>
          You must promptly notify us at <strong>[LEGAL CONTACT EMAIL]</strong> if you discover or
          suspect any security breach, credential leakage, or unauthorized access to your account.
        </LegalParagraph>
      </LegalSection>

      {/* 3. Workspaces & Roles */}
      <LegalSection id="3-workspaces-membership">
        <LegalSectionTitle>3. Workspace Administration & Roles</LegalSectionTitle>
        <LegalParagraph>
          NEXUS operates on a multi-tenant workspace architecture. Workspaces are discrete,
          isolated environments created by users to coordinate projects, tasks, goals, and team
          activities.
        </LegalParagraph>
        <LegalSubsectionTitle>3.1 Workspace Roles & Hierarchy</LegalSubsectionTitle>
        <LegalParagraph>
          Members within a workspace are assigned specific permissions:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Owner:</strong> The creator or designated custodian of the workspace with full
            administrative rights, including billing management, member invitation/removal, role
            reassignment, and workspace deletion.
          </LegalListItem>
          <LegalListItem>
            <strong>Admin:</strong> Designated managers authorized to invite members, manage
            workspace configurations, and configure projects and goals.
          </LegalListItem>
          <LegalListItem>
            <strong>Member:</strong> Active operators permitted to create, update, complete, and
            manage projects, tasks, dependencies, and workspace operational items.
          </LegalListItem>
          <LegalListItem>
            <strong>Viewer:</strong> Read-only access to view projects, task statuses, activity feeds,
            and operational signals without edit permissions.
          </LegalListItem>
        </LegalList>
        <LegalCallout icon="database" title="Tenant Isolation Invariant">
          Every workspace in NEXUS is strictly isolated at the database level using PostgreSQL
          Row-Level Security (RLS). Users can only access workspace data if they hold an active,
          verified membership in that workspace.
        </LegalCallout>
      </LegalSection>

      {/* 4. Plans, Billing & Limits */}
      <LegalSection id="4-plans-billing">
        <LegalSectionTitle>4. Subscription Plans & Resource Limits</LegalSectionTitle>
        <LegalParagraph>
          NEXUS offers different service tiers designed to accommodate varying operational scales:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>FREE Plan:</strong> Provides core workspace functionality subject to strict
            resource caps (e.g., maximum 1 workspace, 2 projects, 50 active tasks, 3 goals, and 1
            member).
          </LegalListItem>
          <LegalListItem>
            <strong>PRO Plan:</strong> Designed for independent operators and leads managing multiple
            parallel initiatives with expanded resource allocations (e.g., up to 5 workspaces, 15
            projects, 1,000 active tasks, 25 goals, and 5 members).
          </LegalListItem>
          <LegalListItem>
            <strong>TEAM Plan:</strong> Tailored for collaborative organizations requiring high
            operational capacity, granular permissions, and advanced cross-project tracking.
          </LegalListItem>
        </LegalList>
        <LegalParagraph>
          Resource limits are enforced atomically on the server side. Attempting to create resources
          exceeding your active plan limits will be blocked by system triggers until you upgrade your
          subscription tier or archive inactive items.
        </LegalParagraph>
        <LegalParagraph>
          Paid subscriptions, billing cycles, renewals, and payment processing terms are managed in
          conjunction with third-party payment gateways (such as FedaPay or regional processors).
          Prices are subject to change upon reasonable advance notice.
        </LegalParagraph>
      </LegalSection>

      {/* 5. User Content & Ownership */}
      <LegalSection id="5-user-content-ownership">
        <LegalSectionTitle>5. User Content & Data Ownership</LegalSectionTitle>
        <LegalParagraph>
          You retain full ownership, title, and intellectual property rights in and to all data, text,
          project descriptions, task records, goals, comments, and files submitted or stored in
          NEXUS by you or your workspace members (&ldquo;User Content&rdquo;).
        </LegalParagraph>
        <LegalParagraph>
          NEXUS does not claim any intellectual property or ownership rights over your User Content.
          You represent and warrant that you possess all necessary rights, licenses, and permissions
          to upload and process your User Content within the Service.
        </LegalParagraph>
      </LegalSection>

      {/* 6. Limited License to NEXUS */}
      <LegalSection id="6-license-to-nexus">
        <LegalSectionTitle>6. Limited Service License to NEXUS</LegalSectionTitle>
        <LegalParagraph>
          In order to operate, host, and deliver the Service, you grant NEXUS a worldwide,
          non-exclusive, royalty-free, limited license to host, store, parse, index, reproduce, and
          display your User Content solely to the extent necessary to:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            Provide, maintain, and support the NEXUS workspace and collaboration features;
          </LegalListItem>
          <LegalListItem>
            Generate deterministic signals, priority rankings, risk detections, and activity feeds
            within your workspace;
          </LegalListItem>
          <LegalListItem>
            Process intelligence queries and agentic action proposals requested by authorized
            workspace members;
          </LegalListItem>
          <LegalListItem>
            Enforce platform security, fraud prevention, and compliance with these Terms.
          </LegalListItem>
        </LegalList>
        <LegalParagraph>
          This license terminates when you delete your User Content, remove your workspace, or close
          your account, subject to standard automated database backup retention cycles.
        </LegalParagraph>
      </LegalSection>

      {/* 7. AI & NEXUS Intelligence */}
      <LegalSection id="7-ai-intelligence">
        <LegalSectionTitle>7. NEXUS Intelligence & AI Features</LegalSectionTitle>
        <LegalParagraph>
          NEXUS includes operational intelligence capabilities (&ldquo;NEXUS Intelligence&rdquo;),
          which analyze workspace status, project deadlines, task dependencies, and recent activity
          to surface operational signals and recommend next best actions.
        </LegalParagraph>
        <LegalSubsectionTitle>7.1 Agentic Security Contract & Human-in-the-Loop</LegalSubsectionTitle>
        <LegalParagraph>
          NEXUS Intelligence operates under strict architectural guardrails:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Proposals vs. Execution:</strong> Artificial intelligence models may analyze
            workspace context and <em>propose</em> actions (such as creating tasks, modifying due
            dates, or adjusting priorities). However, the AI model never directly mutates workspace
            data autonomously.
          </LegalListItem>
          <LegalListItem>
            <strong>Mandatory Human Confirmation:</strong> Any proposed mutation or deletion requires
            explicit review and confirmation by an authenticated user holding appropriate workspace
            permissions.
          </LegalListItem>
          <LegalListItem>
            <strong>Deterministic Grounding:</strong> Intelligence signals and briefings are strictly
            grounded in verified database rows. The model is prohibited from fabricating non-existent
            deadlines or tasks.
          </LegalListItem>
        </LegalList>
        <LegalCallout icon="ai" title="AI Accuracy & Assistive Nature">
          AI-generated insights, summaries, and action recommendations are assistive tools provided
          for operational awareness. They do not substitute for professional human judgment or
          project governance. You remain solely responsible for reviewing and confirming all actions
          executed in your workspace.
        </LegalCallout>
      </LegalSection>

      {/* 8. User Conduct */}
      <LegalSection id="8-user-obligations">
        <LegalSectionTitle>8. User Conduct & Acceptable Use</LegalSectionTitle>
        <LegalParagraph>
          You agree to use NEXUS exclusively for lawful business and operational purposes. You must
          comply with our Acceptable Use Policy at all times. Specifically, you agree not to:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            Interfere with, disrupt, probe, or attempt to compromise the integrity or security of
            NEXUS infrastructure or databases;
          </LegalListItem>
          <LegalListItem>
            Circumvent Row-Level Security, workspace isolation boundaries, or plan-enforced limits;
          </LegalListItem>
          <LegalListItem>
            Upload malicious code, malware, viruses, or unauthorized automated scripts;
          </LegalListItem>
          <LegalListItem>
            Subject the AI infrastructure to prompt injection attacks, automated scraping, or
            adversarial jailbreaking attempts;
          </LegalListItem>
          <LegalListItem>
            Infringe upon the intellectual property, privacy, or confidentiality rights of any third
            party.
          </LegalListItem>
        </LegalList>
      </LegalSection>

      {/* 9. NEXUS IP */}
      <LegalSection id="9-intellectual-property">
        <LegalSectionTitle>9. NEXUS Intellectual Property</LegalSectionTitle>
        <LegalParagraph>
          The Service, including its design systems, visual interfaces, 3D WebGL scenes, logos,
          trademarks, algorithms, signal engine, source code, documentation, and underlying software,
          is the exclusive property of <strong>[LEGAL ENTITY NAME]</strong> and its licensors,
          protected by international copyright, trademark, and trade secret laws.
        </LegalParagraph>
        <LegalParagraph>
          Except as expressly permitted herein, you may not copy, modify, distribute, reverse
          engineer, decompile, or create derivative works based on NEXUS without prior written
          authorization.
        </LegalParagraph>
      </LegalSection>

      {/* 10. Third-Party Services */}
      <LegalSection id="10-third-party-services">
        <LegalSectionTitle>10. Third-Party Integrations & Services</LegalSectionTitle>
        <LegalParagraph>
          The Service relies on established third-party infrastructure providers to deliver its
          features, including:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Supabase Inc.:</strong> Managed PostgreSQL database hosting, authentication, and
            Row-Level Security execution.
          </LegalListItem>
          <LegalListItem>
            <strong>Large Language Model Providers:</strong> OpenAI, LLC and Anthropic, PBC for
            processing natural language queries when configured.
          </LegalListItem>
          <LegalListItem>
            <strong>Hosting & CDN:</strong> Next.js edge and cloud hosting infrastructure.
          </LegalListItem>
        </LegalList>
        <LegalParagraph>
          Your interactions with third-party providers are subject to their respective terms and
          policies. NEXUS is not responsible for external network outages, provider API deprecations,
          or upstream service disruptions.
        </LegalParagraph>
      </LegalSection>

      {/* 11. Availability & Modifications */}
      <LegalSection id="11-service-availability">
        <LegalSectionTitle>11. Platform Availability & Modifications</LegalSectionTitle>
        <LegalParagraph>
          We strive to provide a reliable, performant platform. However, we do not warrant that the
          Service will operate continuously, uninterrupted, or error-free. We may perform scheduled or
          emergency maintenance, roll out updates, or modify features to enhance security,
          performance, or capabilities.
        </LegalParagraph>
        <LegalParagraph>
          We reserve the right to modify or discontinue features of the Service with reasonable
          advance notice when practicable.
        </LegalParagraph>
      </LegalSection>

      {/* 12. Suspension & Termination */}
      <LegalSection id="12-suspension-termination">
        <LegalSectionTitle>12. Suspension & Account Termination</LegalSectionTitle>
        <LegalParagraph>
          <strong>By You:</strong> You may terminate your account at any time by deleting your
          profile and workspaces through the account settings panel.
        </LegalParagraph>
        <LegalParagraph>
          <strong>By NEXUS:</strong> We may suspend or terminate your access to the Service
          immediately, without prior notice or liability, if:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            You commit a material breach of these Terms or the Acceptable Use Policy;
          </LegalListItem>
          <LegalListItem>
            Your account activities pose a genuine security threat to other workspace tenants;
          </LegalListItem>
          <LegalListItem>
            We are required to do so by applicable law, court order, or governmental authority.
          </LegalListItem>
        </LegalList>
        <LegalParagraph>
          Upon termination, your right to use the Service ceases immediately. All provisions of these
          Terms that by their nature should survive termination shall survive (including ownership
          provisions, disclaimers, indemnity, and limitations of liability).
        </LegalParagraph>
      </LegalSection>

      {/* 13. Disclaimers & Limitation of Liability */}
      <LegalSection id="13-disclaimers-liability">
        <LegalSectionTitle>13. Disclaimers & Limitation of Liability</LegalSectionTitle>
        <LegalParagraph>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED ON AN &ldquo;AS
          IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS, WITHOUT WARRANTIES OF ANY KIND, WHETHER
          EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </LegalParagraph>
        <LegalParagraph>
          IN NO EVENT SHALL NEXUS, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, OR AFFILIATES BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
          LOSS OF PROFITS, LOSS OF DATA, WORK INTERRUPTION, SYSTEM FAILURE, OR FINANCIAL LOSSES
          ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE.
        </LegalParagraph>
        <LegalParagraph>
          IN NO EVENT SHALL OUR TOTAL AGGREGATE LIABILITY EXCEED THE AMOUNT PAID BY YOU TO NEXUS IN
          THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR FIFTY US DOLLARS ($50.00 USD), WHICHEVER IS
          GREATER.
        </LegalParagraph>
      </LegalSection>

      {/* 14. Indemnification */}
      <LegalSection id="14-indemnification">
        <LegalSectionTitle>14. Indemnification</LegalSectionTitle>
        <LegalParagraph>
          You agree to defend, indemnify, and hold harmless <strong>[LEGAL ENTITY NAME]</strong>, its
          officers, directors, employees, and agents from and against any claims, liabilities,
          damages, judgments, awards, losses, costs, expenses, or fees (including reasonable legal
          fees) arising out of or relating to your violation of these Terms, your User Content, or
          your unauthorized use of the Service.
        </LegalParagraph>
      </LegalSection>

      {/* 15. Governing Law */}
      <LegalSection id="15-governing-law">
        <LegalSectionTitle>15. Governing Law & Dispute Resolution</LegalSectionTitle>
        <LegalParagraph>
          These Terms shall be governed by and construed in accordance with the substantive laws of
          the jurisdiction where <strong>[LEGAL ENTITY NAME]</strong> is registered, without giving
          effect to any choice-of-law principles.
        </LegalParagraph>
        <LegalParagraph>
          In the event of any controversy or claim arising out of these Terms, the parties agree to
          first seek an informal, good-faith resolution by contacting our legal team. If unresolved
          after thirty (30) days, the dispute shall be submitted to the competent courts of the
          governing jurisdiction.
        </LegalParagraph>
      </LegalSection>

      {/* 16. Amendments */}
      <LegalSection id="16-amendments">
        <LegalSectionTitle>16. Amendments to Terms</LegalSectionTitle>
        <LegalParagraph>
          We may update or revise these Terms from time to time to reflect changes in our Service,
          technologies, legal obligations, or industry practices. When material revisions occur, we
          will provide notice by updating the &ldquo;Last updated&rdquo; date at the top of this page
          and, where appropriate, publishing a notice in the NEXUS application or sending an email to
          registered account owners.
        </LegalParagraph>
        <LegalParagraph>
          Your continued use of NEXUS after the effective date of revised Terms constitutes your
          binding acceptance of the updated terms.
        </LegalParagraph>
      </LegalSection>

      {/* 17. Contact */}
      <LegalSection id="17-contact">
        <LegalSectionTitle>17. Legal Contact Information</LegalSectionTitle>
        <LegalParagraph>
          For legal notices, contractual questions, or formal inquiries regarding these Terms of
          Service, please contact our legal representative:
        </LegalParagraph>

        <LegalContactBox />
      </LegalSection>
    </LegalDocumentLayout>
  );
}
