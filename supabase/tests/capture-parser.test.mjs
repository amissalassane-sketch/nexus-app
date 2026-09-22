// ============================================================
// NEXUS — CAPTURE PARSER CONTRACT TESTS
// ============================================================
// Capture is deterministic natural-language parsing; these tests lock
// the contract for both English and French, including edge cases the
// product promised: dates, urgency, no invented content.
//
// Run:  node --import tsx supabase/tests/capture-parser.test.mjs

const { parseCapture, describeCapture } = await import("../../src/lib/capture.ts");

let passed = 0;
let failed = 0;

function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

function truthy(name, value) {
  if (value) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name} — ${JSON.stringify(value)}`);
  }
}

// A fixed Wednesday so weekday math is deterministic.
const NOW = new Date("2026-09-23T14:30:00"); // Wednesday
const now = () => new Date(NOW);

const dayOf = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "none");

console.log("\n-- capture: relative dates (English) ------------------");
eq("today", dayOf(parseCapture("call the bank today", now()).dueAt), "2026-09-23");
eq("tomorrow", dayOf(parseCapture("send the report tomorrow", now()).dueAt), "2026-09-24");
eq("in 3 days", dayOf(parseCapture("review the contract in 3 days", now()).dueAt), "2026-09-26");
eq("in 2 weeks", dayOf(parseCapture("renew the domain in 2 weeks", now()).dueAt), "2026-10-07");
eq("next week", dayOf(parseCapture("plan the offsite next week", now()).dueAt), "2026-09-30");

console.log("\n-- capture: relative dates (French) -------------------");
eq("aujourd'hui", dayOf(parseCapture("appeler la banque aujourd'hui", now()).dueAt), "2026-09-23");
eq("demain", dayOf(parseCapture("envoyer le rapport demain", now()).dueAt), "2026-09-24");
eq("dans 3 jours", dayOf(parseCapture("relire le contrat dans 3 jours", now()).dueAt), "2026-09-26");
eq("la semaine prochaine", dayOf(parseCapture("préparer la réunion la semaine prochaine", now()).dueAt), "2026-09-30");

console.log("\n-- capture: weekdays ----------------------------------");
// NOW is Wednesday 2026-09-23.
eq("friday", dayOf(parseCapture("deploy friday", now()).dueAt), "2026-09-25");
eq("vendredi", dayOf(parseCapture("déployer vendredi", now()).dueAt), "2026-09-25");
eq("monday → next monday", dayOf(parseCapture("sync with team monday", now()).dueAt), "2026-09-28");
eq("lundi → next lundi", dayOf(parseCapture("point équipe lundi", now()).dueAt), "2026-09-28");
eq("dimanche", dayOf(parseCapture("appel famille dimanche", now()).dueAt), "2026-09-27");

console.log("\n-- capture: explicit dates ----------------------------");
eq("iso date", dayOf(parseCapture("file taxes 2026-10-15", now()).dueAt), "2026-10-15");
eq("d/m date", dayOf(parseCapture("renew passport 05/11", now()).dueAt), "2026-11-05");
eq("month name", dayOf(parseCapture("launch 24 sept", now()).dueAt), "2026-09-24");
eq("month name fr", dayOf(parseCapture("lancement 24 septembre", now()).dueAt), "2026-09-24");

console.log("\n-- capture: priority ----------------------------------");
eq("urgent word", parseCapture("fix the outage urgent", now()).priority, "urgent");
eq("asap", parseCapture("reply asap", now()).priority, "urgent");
eq("important", parseCapture("send the contract important", now()).priority, "high");
eq("il faut (fr)", parseCapture("il faut que je réponde au client", now()).priority, "high");
eq("someday", parseCapture("learn rust someday", now()).priority, "low");
eq("default", parseCapture("buy coffee", now()).priority, "medium");

console.log("\n-- capture: title hygiene -----------------------------");
eq(
  "french lead-in removed (verb form is kept as typed, never re-conjugated)",
  parseCapture("il faut que je prépare la présentation demain", now()).title,
  "prépare la présentation"
);
eq(
  "english lead-in removed",
  parseCapture("i need to book the flight tomorrow", now()).title,
  "book the flight"
);
eq(
  "date expression removed from title",
  parseCapture("review contract friday", now()).title,
  "review contract"
);
eq("empty input keeps raw words", parseCapture("demain", now()).title, "demain");

console.log("\n-- capture: honesty rules -----------------------------");
const noDate = parseCapture("think about the architecture", now());
eq("no invented date", noDate.dueAt, null);
eq("no invented expression", noDate.dueExpression, null);

const noteIntent = parseCapture("note that the staging DB is shared with QA", now());
truthy("note markers detected", noteIntent.looksLikeNote);

truthy(
  "describeCapture states what was understood",
  describeCapture(parseCapture("call marie tomorrow", now())).includes("call marie")
);

console.log("\n-- capture: never loses the user's words --------------");
eq(
  "unparsed words stay in the title",
  parseCapture("water the plants and buy milk tomorrow", now()).title,
  "water the plants and buy milk"
);

console.log(`\n${passed} passed / ${failed} failed`);
if (failed > 0) process.exit(1);
