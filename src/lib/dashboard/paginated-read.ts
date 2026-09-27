const DEFAULT_PAGE_SIZE = 1000;

type PageResult<T, E> = {
  data: T[] | null;
  error: E | null;
};

/** Read a complete result set in bounded, ordered pages. */
export async function readAllPages<T, E>(
  readPage: (from: number, to: number) => PromiseLike<PageResult<T, E>>,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<{ data: T[]; error: E | null }> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError("pageSize must be a positive integer");
  }

  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await readPage(from, from + pageSize - 1);
    if (error) return { data: [], error };

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
