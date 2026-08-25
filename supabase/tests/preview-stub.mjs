/**
 * Preview stub launcher — brings up the Supabase test double on
 * 127.0.0.1:54321 for the application server.
 *
 * Usage (sandbox preview):
 *   node supabase/tests/preview-stub.mjs &
 *   npm run start -- --port 3000
 *
 * The production build must have been created with
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key
 *
 * This Next.js version freezes NEXT_PUBLIC_* values into the bundles at
 * build time (runtime overrides are ignored), so the server client and the
 * browser client use the SAME URL string. The server reaches the stub
 * locally; the browser (on the preview host) cannot reach 127.0.0.1, which
 * means everything that is server-driven (pages, email/password auth,
 * profile completion, navigation) works in the preview, while the Google
 * OAuth button — the only browser-side Supabase call — cannot complete its
 * provider round trip in the sandbox preview. That flow is covered by the
 * e2e suite instead (supabase/tests/auth-flow.test.mjs).
 *
 * To expose the stub to the browser directly (e.g. for manual API poking),
 * start a second listener over the SAME shared store:
 *   startSupabaseStub(54443, "0.0.0.0", shared)
 */

import { startSupabaseStub } from "./supabase-stub.mjs";

const stub = await startSupabaseStub(54321, "127.0.0.1");

console.log(`preview stub: ${stub.url}`);
setInterval(() => {}, 60_000);
