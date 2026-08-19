/**
 * PostgREST / Postgres errors that mean "this column is not on the
 * live database". Migrations 013/014 add `profiles.onboarding_intent`,
 * but hosted projects that never applied them must not brick onboarding.
 */
export function isMissingColumnError(
  message: string | undefined | null,
  column: string
): boolean {
  if (!message) return false;
  const haystack = message.toLowerCase();
  const needle = column.toLowerCase();
  if (!haystack.includes(needle)) return false;
  return (
    haystack.includes("does not exist") ||
    haystack.includes("schema cache") ||
    haystack.includes("could not find")
  );
}
