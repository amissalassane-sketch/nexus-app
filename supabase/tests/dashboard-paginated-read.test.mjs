import assert from "node:assert/strict";
const { readAllPages } = await import("../../src/lib/dashboard/paginated-read.ts");

const sourceRows = Array.from({ length: 2_501 }, (_, index) => ({ id: index }));
const requestedRanges = [];
const complete = await readAllPages(async (from, to) => {
  requestedRanges.push([from, to]);
  return { data: sourceRows.slice(from, to + 1), error: null };
});

assert.deepEqual(complete.data, sourceRows);
assert.equal(complete.error, null);
assert.deepEqual(requestedRanges, [
  [0, 999],
  [1_000, 1_999],
  [2_000, 2_999],
]);

const readError = { code: "PGRST000", message: "read failed" };
let pageCount = 0;
const failed = await readAllPages(async () => {
  pageCount += 1;
  return pageCount === 1
    ? { data: sourceRows.slice(0, 1_000), error: null }
    : { data: null, error: readError };
});

assert.deepEqual(failed.data, [], "partial data is discarded on a failed page");
assert.equal(failed.error, readError);

await assert.rejects(
  readAllPages(async () => ({ data: [], error: null }), 0),
  RangeError
);

console.log("Dashboard paginated-read tests passed.");
