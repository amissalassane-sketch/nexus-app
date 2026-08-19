/**
 * Regression: onboarding must recognise a missing
 * profiles.onboarding_intent column, otherwise "Skip & enter NEXUS"
 * sticks on "Finishing…" and a raw Postgres error stays on screen.
 *
 * Keep this wording in sync with src/lib/schema-errors.ts.
 */

function isMissingColumnError(message, column) {
  if (!message) return false;
  const haystack = String(message).toLowerCase();
  const needle = column.toLowerCase();
  if (!haystack.includes(needle)) return false;
  return (
    haystack.includes("does not exist") ||
    haystack.includes("schema cache") ||
    haystack.includes("could not find")
  );
}

const cases = [
  [true, "column profiles.onboarding_intent does not exist", "onboarding_intent"],
  [
    true,
    "Could not find the 'onboarding_intent' column of 'profiles' in the schema cache",
    "onboarding_intent",
  ],
  [false, "column profiles.onboarding_intent does not exist", "display_name"],
  [false, "duplicate key value violates unique constraint", "onboarding_intent"],
  [false, "", "onboarding_intent"],
  [false, null, "onboarding_intent"],
];

let failed = 0;
for (const [expected, message, column] of cases) {
  const actual = isMissingColumnError(message, column);
  if (actual !== expected) {
    failed += 1;
    console.log(`FAIL  ${JSON.stringify(message)} / ${column} => ${actual}`);
  } else {
    console.log(`PASS  ${JSON.stringify(message)}`);
  }
}

if (failed > 0) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}

console.log("\nAll schema-error cases passed.");
