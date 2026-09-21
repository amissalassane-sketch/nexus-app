/**
 * ============================================================
 * NEXUS — DATA ERROR DIAGNOSTICS (src/lib/data-errors.ts)
 * ============================================================
 * The product managers (projects, tasks, goals) show a friendly sentence
 * when a Supabase read/write fails, and — since this contract — the real
 * SQLSTATE / PGRST code, bounded message and hint in small text under it,
 * plus one console.error line. This suite pins:
 *
 *   DATA-ERR-01  describeDataError keeps exactly code / message / hint,
 *                never `details` (Postgres puts row values in it)
 *   DATA-ERR-02  bounds: message <= 300 chars, hint <= 200, code "unknown"
 *                when absent, null when there is nothing to diagnose
 *   DATA-ERR-03  formatDataErrorLine / logDataError write ONE greppable
 *                line in the same shape as the server runtime logs
 *   DATA-ERR-04  humanizeDataError: which raw errors land in the
 *                "temporarily unavailable" bucket — the reason the banner
 *                alone cannot tell a schema-cache miss from a NOT NULL
 *                violation, and why the code is rendered separately
 *
 * Run:  node --import tsx supabase/tests/data-errors.test.mjs
 */

const {
  describeDataError,
  formatDataErrorLine,
  humanizeDataError,
  logDataError,
} = await import("../../src/lib/data-errors.ts");

let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

// ============================================================
console.log("\n-- DATA-ERR-01: the triple, and only the triple --------------");
// ============================================================
const unique = {
  code: "23505",
  message: 'duplicate key value violates unique constraint "projects_workspace_id_slug_key"',
  details: "Key (workspace_id, slug)=(0b1f6c2e-0000-4000-8000-000000000000, website-x1y2z3) already exists.",
  hint: null,
};
const uniqueDetail = describeDataError(unique);
assert("code is kept verbatim", uniqueDetail?.code === "23505", JSON.stringify(uniqueDetail));
assert("message is kept verbatim", uniqueDetail?.message === unique.message);
assert(
  "`details` (row values) is never part of the diagnostic",
  !("details" in (uniqueDetail ?? {})) &&
    !JSON.stringify(uniqueDetail).includes("0b1f6c2e") &&
    !JSON.stringify(uniqueDetail).includes("website-x1y2z3"),
  JSON.stringify(uniqueDetail)
);
assert("an empty hint is omitted, not rendered as an empty string", !("hint" in (uniqueDetail ?? {})));

const withHint = describeDataError({
  code: "PGRST204",
  message: "Could not find the 'due_date' column of 'projects' in the schema cache",
  hint: "Reload the schema cache: notify pgrst, 'reload schema'",
});
assert("hint is kept when the database supplied one", withHint?.hint?.startsWith("Reload the schema cache") === true);

// ============================================================
console.log("\n-- DATA-ERR-02: bounds and edge cases -------------------------");
// ============================================================
assert("null error -> null diagnostic", describeDataError(null) === null);
assert("undefined error -> null diagnostic", describeDataError(undefined) === null);
assert("error with neither code nor message -> null diagnostic", describeDataError({}) === null);
assert(
  "whitespace-only code and message -> null diagnostic",
  describeDataError({ code: "  ", message: "\n" }) === null
);
assert(
  "missing code becomes \"unknown\" (a transport error still gets a line)",
  describeDataError({ message: "TypeError: Failed to fetch" })?.code === "unknown"
);
const long = describeDataError({ code: "42703", message: "m".repeat(1000), hint: "h".repeat(1000) });
assert("message is bounded to 300 characters", long?.message.length === 300, String(long?.message.length));
assert("hint is bounded to 200 characters", long?.hint?.length === 200, String(long?.hint?.length));
assert(
  "numeric codes are stringified (PostgREST occasionally sends numbers)",
  describeDataError({ code: 500, message: "x" })?.code === "500"
);

// ============================================================
console.log("\n-- DATA-ERR-03: one greppable line, same shape as the server --");
// ============================================================
const line = formatDataErrorLine("projects.create", {
  code: "22P02",
  message: 'invalid input syntax for type uuid: ""',
  hint: "Check the id.",
});
assert(
  "line = [nexus-data] <context> failed code=<code> message=<json> hint=<json>",
  line ===
    '[nexus-data] projects.create failed code=22P02 message="invalid input syntax for type uuid: \\"\\"" hint="Check the id."',
  line
);
assert("line has no newline (one log entry per failure)", !line.includes("\n"));
assert(
  "hint is omitted from the line when absent",
  formatDataErrorLine("tasks.load", { code: "42501", message: "permission denied" }) ===
    '[nexus-data] tasks.load failed code=42501 message="permission denied"'
);

const captured = [];
const originalError = console.error;
console.error = (...args) => captured.push(args);
try {
  const returned = logDataError("goals.update", {
    code: "42501",
    message: "permission denied for table goals",
    details: "row values would be here",
  });
  assert("logDataError writes exactly one console.error call", captured.length === 1, String(captured.length));
  assert(
    "…with the single formatted line as its only argument (never the raw error object)",
    captured[0]?.length === 1 &&
      captured[0][0] === '[nexus-data] goals.update failed code=42501 message="permission denied for table goals"',
    JSON.stringify(captured[0])
  );
  assert("logDataError returns the triple for the UI", returned?.code === "42501");
  captured.length = 0;
  assert("logDataError is a no-op on a missing error", logDataError("x", null) === null && captured.length === 0);
} finally {
  console.error = originalError;
}

// ============================================================
console.log("\n-- DATA-ERR-04: what lands in the 'temporarily unavailable' bucket");
// ============================================================
const UNAVAILABLE = "This workspace is temporarily unavailable while its data structure is updated. Try again shortly.";
const FALLBACK = "This change could not be completed. Please try again.";

const bucket = (error) => humanizeDataError(error);
assert(
  "PGRST204 (column missing from the schema cache) -> unavailable",
  bucket({ code: "PGRST204", message: "Could not find the 'due_date' column of 'projects' in the schema cache" }) === UNAVAILABLE
);
assert(
  "any other PGRST* code (e.g. PGRST202 unknown function) -> unavailable",
  bucket({ code: "PGRST202", message: "Could not find the function public.x in the schema cache" }) === UNAVAILABLE
);
assert(
  "42703 (column does not exist) -> unavailable",
  bucket({ code: "42703", message: "column projects.due_date does not exist" }) === UNAVAILABLE
);
assert(
  "23502 NOT NULL violation ALSO lands in the bucket — its message contains the word 'column'",
  bucket({ code: "23502", message: 'null value in column "owner_id" of relation "projects" violates not-null constraint' }) === UNAVAILABLE
);
assert(
  "42804 datatype mismatch ALSO lands in the bucket — same reason",
  bucket({ code: "42804", message: 'column "due_date" is of type date but expression is of type integer' }) === UNAVAILABLE
);
assert(
  "22P02 invalid text representation (uuid/enum) does NOT: it falls to the generic fallback",
  bucket({ code: "22P02", message: 'invalid input value for enum project_status: "Planning"' }) === FALLBACK
);
assert(
  "23514 check-constraint violation does NOT: generic fallback",
  bucket({ code: "23514", message: 'new row for relation "projects" violates check constraint "projects_status_check"' }) === FALLBACK
);
assert(
  "23505 duplicate keeps its own copy",
  bucket(unique).startsWith("An item with these details already exists")
);
assert(
  "42501 / RLS keeps its own copy",
  bucket({ code: "42501", message: "new row violates row-level security policy for table \"projects\"" }).startsWith(
    "You do not have permission"
  )
);

// ---- summary -------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
