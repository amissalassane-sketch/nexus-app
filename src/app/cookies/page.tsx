import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/legal-layout";
import { COOKIES_TOC } from "@/components/legal/legal-data";
import {
  LegalSection,
  LegalSectionTitle,
  LegalParagraph,
  LegalList,
  LegalListItem,
  LegalCallout,
  LegalTable,
  LegalContactBox,
} from "@/components/legal/legal-ui";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Technical and transparent disclosure of all cookies, local storage keys, and telemetry used in NEXUS.",
  alternates: { canonical: "/cookies" },
  openGraph: {
    url: "/cookies",
    title: "Cookie Policy · NEXUS",
    description: "Detailed inventory of essential authentication cookies and functional client storage keys.",
  },
};

const STORAGE_TABLE_HEADERS = [
  "Storage Key / Cookie",
  "Type & Origin",
  "Category",
  "Duration",
  "Technical Purpose",
];

const STORAGE_TABLE_ROWS = [
  [
    <code key="1" className="font-mono text-text-primary text-[12px]">sb-*-auth-token</code>,
    "HTTP Cookie (First-party / Supabase SSR)",
    <span key="1c" className="text-success font-medium">Strictly Necessary</span>,
    "Session / 7 to 30 days (auto-refreshed)",
    "Maintains authenticated session state between Server Components, proxy middleware, and client API requests.",
  ],
  [
    <code key="2" className="font-mono text-text-primary text-[12px]">sb-*-auth-token-code-verifier</code>,
    "HTTP Cookie (First-party / Supabase SSR)",
    <span key="2c" className="text-success font-medium">Strictly Necessary</span>,
    "Ephemeral (Auth exchange window)",
    "PKCE security code verifier used to prevent auth interception during OAuth and OTP verification.",
  ],
  [
    <code key="3" className="font-mono text-text-primary text-[12px]">nexus:recent-commands</code>,
    "Browser LocalStorage",
    <span key="3c" className="text-info font-medium">Functional</span>,
    "Persistent (Until cleared by user)",
    "Caches recent search targets in the Command Menu (⌘K) for instant keyboard navigation.",
  ],
  [
    <code key="4" className="font-mono text-text-primary text-[12px]">nexus:intelligence-ask:memory</code>,
    "Browser LocalStorage",
    <span key="4c" className="text-info font-medium">Functional</span>,
    "Persistent (Until cleared by user)",
    "Stores client-side working memory cache for the active intelligence session to reduce interface flicker.",
  ],
  [
    <code key="5" className="font-mono text-text-primary text-[12px]">nexus:onboarding:[userId]</code>,
    "Browser LocalStorage",
    <span key="5c" className="text-info font-medium">Functional</span>,
    "Persistent (Until cleared by user)",
    "Tracks progressive completion of the non-blocking workspace activation checklist.",
  ],
  [
    <code key="6" className="font-mono text-text-primary text-[12px]">nexus:launch:seen</code>,
    "Browser SessionStorage",
    <span key="6c" className="text-info font-medium">Functional</span>,
    "Browser Tab Session",
    "Remembers whether the introductory visual entrance has already been displayed during the current session.",
  ],
];

export default function CookiesPage() {
  return (
    <LegalDocumentLayout docId="cookies" toc={COOKIES_TOC}>
      {/* 1. Overview */}
      <LegalSection id="1-overview-scope">
        <LegalSectionTitle>1. Overview & Scope</LegalSectionTitle>
        <LegalParagraph>
          This Cookie Policy explains how <strong>[LEGAL ENTITY NAME]</strong> (&ldquo;NEXUS&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) uses cookies, local browser
          storage, and related web technologies when you access our intelligent workspace application
          at <a href="/" className="text-text-primary underline">nexus.app</a> and related domains.
        </LegalParagraph>
        <LegalParagraph>
          Unlike traditional web services that embed dozens of third-party advertising trackers and
          behavioral profiling scripts, NEXUS adheres to a strict data-minimalist philosophy: we
          employ <strong>only strictly necessary authentication cookies</strong> and{" "}
          <strong>functional client-side storage keys</strong> necessary to power your workspace
          experience.
        </LegalParagraph>
      </LegalSection>

      {/* 2. Storage Philosophy */}
      <LegalSection id="2-storage-philosophy">
        <LegalSectionTitle>2. Our Storage Philosophy</LegalSectionTitle>
        <LegalParagraph>
          We believe that an executive workspace must respect your privacy by design. Our technical
          commitments include:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>No Third-Party Advertising Trackers:</strong> We do not load Google Ads, Meta
            Pixel, TikTok Pixel, or any commercial ad network scripts.
          </LegalListItem>
          <LegalListItem>
            <strong>No Cross-Site Behavioral Tracking:</strong> We never track your browsing behavior
            across other websites, applications, or external services.
          </LegalListItem>
          <LegalListItem>
            <strong>No Commercial Telemetry Sale:</strong> We do not monetize, sell, or share user
            telemetry or browser fingerprints with data brokers.
          </LegalListItem>
        </LegalList>
        <LegalCallout icon="info" title="Privacy by Default">
          Because NEXUS uses only strictly necessary authentication cookies and client-side functional
          state, you will not encounter disruptive advertising cookie consent banners designed to
          extract consent for marketing trackers.
        </LegalCallout>
      </LegalSection>

      {/* 3. Necessary Cookies */}
      <LegalSection id="3-necessary-cookies">
        <LegalSectionTitle>3. Strictly Necessary Session Cookies</LegalSectionTitle>
        <LegalParagraph>
          Strictly necessary cookies are essential for the operation of NEXUS. Without these cookies,
          the application cannot authenticate your identity, enforce database Row-Level Security, or
          protect your workspace from unauthorized access.
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Supabase SSR Authentication Tokens (<code>sb-*-auth-token</code>):</strong> Stored
            securely via HTTP cookies with <code>SameSite=Lax</code> and <code>Secure</code> flags.
            These cookies carry cryptographically signed session tokens that allow the Next.js server
            runtime and edge middleware to verify your authenticated identity on every request.
          </LegalListItem>
          <LegalListItem>
            <strong>PKCE Security Code Verifiers (<code>sb-*-auth-token-code-verifier</code>):</strong> Ephemeral
            tokens generated during the login and OAuth confirmation lifecycle to verify that the
            authenticating client matches the requesting browser session, preventing man-in-the-middle
            and authorization code interception attacks.
          </LegalListItem>
        </LegalList>
      </LegalSection>

      {/* 4. Local Storage */}
      <LegalSection id="4-local-storage">
        <LegalSectionTitle>4. Functional Local Storage (Client State)</LegalSectionTitle>
        <LegalParagraph>
          Local storage (<code>window.localStorage</code>) allows the browser to retain lightweight
          interface preferences locally on your device without transmitting them across the network on
          every HTTP request:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Command Palette History (<code>nexus:recent-commands</code>):</strong> Stores
            recently opened projects, tasks, and commands within the ⌘K navigation menu for instant
            autocomplete.
          </LegalListItem>
          <LegalListItem>
            <strong>Assistant Working Memory (<code>nexus:intelligence-ask:memory</code>):</strong> Caches
            recent conversational state in the Intelligence assistant panel to prevent UI layout
            flicker during page transitions.
          </LegalListItem>
          <LegalListItem>
            <strong>Onboarding Checklist Progress (<code>nexus:onboarding:[userId]</code>):</strong> Stores
            the local completion state of first-run workspace guidance tours.
          </LegalListItem>
        </LegalList>
      </LegalSection>

      {/* 5. Session Storage */}
      <LegalSection id="5-session-storage">
        <LegalSectionTitle>5. Ephemeral Session Storage</LegalSectionTitle>
        <LegalParagraph>
          Session storage (<code>window.sessionStorage</code>) is isolated to a single browser tab and
          is automatically cleared as soon as the tab or browser window is closed:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Launch Intro State (<code>nexus:launch:seen</code>):</strong> Flags whether the
            cinematic workspace entrance animation has already played in the current browser session,
            ensuring you are not interrupted by repeated animations when navigating between pages.
          </LegalListItem>
        </LegalList>
      </LegalSection>

      {/* 6. Diagnostics */}
      <LegalSection id="6-in-browser-telemetry">
        <LegalSectionTitle>6. Diagnostics & Local Event Telemetry</LegalSectionTitle>
        <LegalParagraph>
          NEXUS employs an internal in-browser event dispatcher (<code>nexus:analytics</code>) purely
          as a standard JavaScript <code>CustomEvent</code> to coordinate UI state transitions (such as
          detecting when a user completes their first task to trigger the next onboarding step).
        </LegalParagraph>
        <LegalParagraph>
          These events are evaluated locally in browser memory and are not sent to any external
          commercial analytics services or data tracking vendors.
        </LegalParagraph>
      </LegalSection>

      {/* 7. No Third-Party Tracking */}
      <LegalSection id="7-no-third-party-tracking">
        <LegalSectionTitle>7. Zero Third-Party Advertising Policy</LegalSectionTitle>
        <LegalParagraph>
          We do not embed third-party tracking cookies or marketing beacons from social media
          networks, behavioral analytics vendors, or programmatic ad exchanges.
        </LegalParagraph>
        <LegalParagraph>
          When you log in using a third-party identity provider (such as Google OAuth), that provider
          may set its own cookies on their respective authentication domain in accordance with their
          independent privacy policies. NEXUS does not receive, read, or store external provider
          advertising cookies.
        </LegalParagraph>
      </LegalSection>

      {/* 8. Technical Table */}
      <LegalSection id="8-technical-table">
        <LegalSectionTitle>8. Technical Storage Specifications</LegalSectionTitle>
        <LegalParagraph>
          The table below provides a comprehensive technical breakdown of all storage keys utilized
          by NEXUS:
        </LegalParagraph>

        <LegalTable
          headers={STORAGE_TABLE_HEADERS}
          rows={STORAGE_TABLE_ROWS}
          caption="Technical disclosure of all cookies and local storage keys in NEXUS"
        />
      </LegalSection>

      {/* 9. Managing Storage */}
      <LegalSection id="9-managing-storage">
        <LegalSectionTitle>9. Managing Storage & Cookie Preferences</LegalSectionTitle>
        <LegalParagraph>
          Because our cookies are strictly necessary to provide authentication and secure workspace
          isolation, disabling cookies entirely in your browser will prevent you from signing in or
          using NEXUS.
        </LegalParagraph>
        <LegalParagraph>
          However, you can inspect, delete, or block cookies and local storage items at any time
          through your browser settings:
        </LegalParagraph>
        <LegalList>
          <LegalListItem>
            <strong>Google Chrome / Chromium:</strong> Settings &rarr; Privacy and security &rarr;
            Cookies and other site data &rarr; See all site data and permissions.
          </LegalListItem>
          <LegalListItem>
            <strong>Mozilla Firefox:</strong> Settings &rarr; Privacy &amp; Security &rarr; Cookies
            and Site Data &rarr; Manage Data.
          </LegalListItem>
          <LegalListItem>
            <strong>Apple Safari:</strong> Settings &rarr; Safari &rarr; Advanced &rarr; Website Data.
          </LegalListItem>
        </LegalList>
      </LegalSection>

      {/* 10. Updates & Contact */}
      <LegalSection id="10-updates-contact">
        <LegalSectionTitle>10. Policy Updates & Inquiries</LegalSectionTitle>
        <LegalParagraph>
          We may update this Cookie Policy if technical changes to our authentication architecture or
          storage mechanisms occur. Revisions will be published on this page with an updated
          &ldquo;Last updated&rdquo; timestamp.
        </LegalParagraph>
        <LegalParagraph>
          For technical or legal questions regarding our storage practices, please contact our
          compliance team:
        </LegalParagraph>

        <LegalContactBox />
      </LegalSection>
    </LegalDocumentLayout>
  );
}
