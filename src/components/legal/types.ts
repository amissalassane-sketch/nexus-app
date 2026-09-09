export type LegalDocumentId = "terms" | "privacy" | "cookies" | "acceptable-use";

export interface LegalTocItem {
  id: string;
  title: string;
  level?: 2 | 3;
}

export interface LegalDocumentMeta {
  id: LegalDocumentId;
  slug: string;
  href: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  summary: string;
  lastUpdated: string;
  effectiveDate: string;
  readingTime: string;
  version: string;
  highlights: string[];
}
