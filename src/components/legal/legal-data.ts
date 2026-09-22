import type { LegalDocumentId, LegalDocumentMeta, LegalTocItem } from "./types";

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocumentMeta> = {
  terms: {
    id: "terms",
    slug: "terms",
    href: "/terms",
    title: "Terms of Service",
    eyebrow: "User Agreement",
    subtitle:
      "The terms, rules, and conditions governing your access to and use of NEXUS workspaces, features, and platform services.",
    summary:
      "These Terms of Service govern your access to NEXUS. They describe workspace ownership, subscription plans, data rights, AI assistance limits, user obligations, and dispute terms.",
    lastUpdated: "September 9, 2026",
    effectiveDate: "September 9, 2026",
    readingTime: "12 min read",
    version: "2.1",
    highlights: [
      "Workspace-level tenant isolation",
      "Customer retains full data ownership",
      "AI proposes actions; human confirmation executes",
      "Transparent subscription limits",
    ],
  },
  privacy: {
    id: "privacy",
    slug: "privacy",
    href: "/privacy",
    title: "Privacy Policy",
    eyebrow: "Data Protection & Privacy",
    subtitle:
      "How NEXUS collects, processes, stores, and protects workspace data, user identities, and operational telemetry.",
    summary:
      "This Privacy Policy explains what data NEXUS collects, how workspace context is processed by our intelligence engine, how data is isolated via Row-Level Security, and your privacy rights.",
    lastUpdated: "September 9, 2026",
    effectiveDate: "September 9, 2026",
    readingTime: "14 min read",
    version: "2.1",
    highlights: [
      "PostgreSQL Row-Level Security (RLS)",
      "Zero cross-site or third-party ad tracking",
      "Workspace context isolated per tenant",
      "Limited memory controls; full rights workflow pending",
    ],
  },
  cookies: {
    id: "cookies",
    slug: "cookies",
    href: "/cookies",
    title: "Cookie Policy",
    eyebrow: "Storage & Cookie Disclosure",
    subtitle:
      "A technical, transparent disclosure of the essential cookies, local storage keys, and telemetry mechanisms used in NEXUS.",
    summary:
      "NEXUS only uses strictly necessary authentication cookies and functional client-side storage. We do not use third-party advertising cookies, tracker pixels, or third-party behavioral analytics.",
    lastUpdated: "September 9, 2026",
    effectiveDate: "September 9, 2026",
    readingTime: "6 min read",
    version: "2.0",
    highlights: [
      "Strictly necessary Supabase SSR auth cookies",
      "Functional LocalStorage for UI preferences",
      "Zero third-party advertising or marketing trackers",
      "No cross-device or behavioral profiling",
    ],
  },
  "acceptable-use": {
    id: "acceptable-use",
    slug: "acceptable-use",
    href: "/acceptable-use",
    title: "Acceptable Use Policy",
    eyebrow: "Platform Rules & Safety",
    subtitle:
      "Operational guidelines, security standards, and AI safety practices expected from all NEXUS workspace users.",
    summary:
      "This Acceptable Use Policy defines prohibited conduct, infrastructure security boundaries, responsible AI interactions, and multi-tenant fairness rules across all NEXUS workspaces.",
    lastUpdated: "September 9, 2026",
    effectiveDate: "September 9, 2026",
    readingTime: "8 min read",
    version: "2.0",
    highlights: [
      "Strict prohibition of security probing or abuse",
      "Fair use of automated tools and rate limits",
      "Responsible use of AI prompting and intelligence",
      "Transparent reporting and violation enforcement",
    ],
  },
};

export const LEGAL_DOCUMENTS_LIST: LegalDocumentMeta[] = [
  LEGAL_DOCUMENTS.terms,
  LEGAL_DOCUMENTS.privacy,
  LEGAL_DOCUMENTS.cookies,
  LEGAL_DOCUMENTS["acceptable-use"],
];

export const TERMS_TOC: LegalTocItem[] = [
  { id: "1-introduction-acceptance", title: "1. Introduction & Acceptance of Terms" },
  { id: "2-eligibility-account", title: "2. Eligibility & Account Registration" },
  { id: "3-workspaces-membership", title: "3. Workspace Administration & Roles" },
  { id: "4-plans-billing", title: "4. Subscription Plans & Resource Limits" },
  { id: "5-user-content-ownership", title: "5. User Content & Data Ownership" },
  { id: "6-license-to-nexus", title: "6. Limited Service License to NEXUS" },
  { id: "7-ai-intelligence", title: "7. NEXUS Intelligence & AI Features" },
  { id: "8-user-obligations", title: "8. User Conduct & Acceptable Use" },
  { id: "9-intellectual-property", title: "9. NEXUS Intellectual Property" },
  { id: "10-third-party-services", title: "10. Third-Party Integrations & Services" },
  { id: "11-service-availability", title: "11. Platform Availability & Modifications" },
  { id: "12-suspension-termination", title: "12. Suspension & Account Termination" },
  { id: "13-disclaimers-liability", title: "13. Disclaimers & Limitation of Liability" },
  { id: "14-indemnification", title: "14. Indemnification" },
  { id: "15-governing-law", title: "15. Governing Law & Dispute Resolution" },
  { id: "16-amendments", title: "16. Amendments to Terms" },
  { id: "17-contact", title: "17. Legal Contact Information" },
];

export const PRIVACY_TOC: LegalTocItem[] = [
  { id: "1-introduction-controller", title: "1. Introduction & Data Controller" },
  { id: "2-principles", title: "2. Principles of Data Protection" },
  { id: "3-data-collected", title: "3. Categories of Data We Collect" },
  { id: "4-how-we-use-data", title: "4. How We Use Collected Data" },
  { id: "5-ai-processing", title: "5. AI Processing & NEXUS Intelligence" },
  { id: "6-legal-bases", title: "6. Legal Bases for Processing" },
  { id: "7-storage-architecture", title: "7. Multi-Tenant Storage & Architecture" },
  { id: "8-data-sharing", title: "8. Data Sharing & Third-Party Processors" },
  { id: "9-data-retention", title: "9. Data Retention & Account Deletion" },
  { id: "10-security-measures", title: "10. Security Measures & Incident Protocol" },
  { id: "11-user-rights", title: "11. User Rights & Data Subject Requests" },
  { id: "12-international-transfers", title: "12. International Data Transfers" },
  { id: "13-cookies-storage", title: "13. Cookies & Local Storage Technologies" },
  { id: "14-childrens-privacy", title: "14. Children's Privacy" },
  { id: "15-policy-changes", title: "15. Changes to This Privacy Policy" },
  { id: "16-contact-dpo", title: "16. Contact & Data Protection Inquiries" },
];

export const COOKIES_TOC: LegalTocItem[] = [
  { id: "1-overview-scope", title: "1. Overview & Scope" },
  { id: "2-storage-philosophy", title: "2. Our Storage Philosophy" },
  { id: "3-necessary-cookies", title: "3. Strictly Necessary Session Cookies" },
  { id: "4-local-storage", title: "4. Functional Local Storage (Client State)" },
  { id: "5-session-storage", title: "5. Ephemeral Session Storage" },
  { id: "6-in-browser-telemetry", title: "6. Diagnostics & Local Event Telemetry" },
  { id: "7-no-third-party-tracking", title: "7. Zero Third-Party Advertising Policy" },
  { id: "8-technical-table", title: "8. Technical Storage Specifications" },
  { id: "9-managing-storage", title: "9. Managing Storage & Cookie Preferences" },
  { id: "10-updates-contact", title: "10. Policy Updates & Inquiries" },
];

export const ACCEPTABLE_USE_TOC: LegalTocItem[] = [
  { id: "1-purpose-scope", title: "1. Purpose & Scope of Application" },
  { id: "2-infrastructure-security", title: "2. System Security & Infrastructure Protection" },
  { id: "3-prohibited-activities", title: "3. Prohibited Content & Malicious Activities" },
  { id: "4-responsible-ai-use", title: "4. Responsible Use of NEXUS Intelligence (AI)" },
  { id: "5-workspace-fair-use", title: "5. Workspace Etiquette & Multi-Tenant Fair Use" },
  { id: "6-scraping-automation", title: "6. Automated Access, Rate Limiting & Scraping" },
  { id: "7-enforcement-penalties", title: "7. Violation Enforcement & Account Suspension" },
  { id: "8-reporting-violations", title: "8. Reporting Violations" },
  { id: "9-updates-inquiries", title: "9. Policy Updates & Contact" },
];
