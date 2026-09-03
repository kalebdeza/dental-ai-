export const SCHEDULER_SUPABASE_PAGE_SIZE = 1000;
export const SCHEDULER_SUPABASE_MAX_PAGES = 10_000;

export class SchedulerSupabasePageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulerSupabasePageError";
  }
}

type RangeResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

type RangeQuery<T> = {
  range: (from: number, to: number) => PromiseLike<RangeResult<T>>;
};

/**
 * Pages a PostgREST query with explicit .range() so a practice with more
 * than the default ~1000-row cap is not silently truncated.
 *
 * createQuery must return a fresh builder each call; Supabase builders
 * are not safe to reuse across ranges.
 */
export async function paginateSupabaseQuery<T>(
  createQuery: () => RangeQuery<T>,
  options?: {
    pageSize?: number;
    maxPages?: number;
  }
): Promise<T[]> {
  const pageSize = options?.pageSize ?? SCHEDULER_SUPABASE_PAGE_SIZE;
  const maxPages = options?.maxPages ?? SCHEDULER_SUPABASE_MAX_PAGES;

  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    throw new SchedulerSupabasePageError("Invalid Supabase page size.");
  }

  const rows: T[] = [];
  let from = 0;
  let pages = 0;

  while (pages < maxPages) {
    const to = from + pageSize - 1;
    const { data, error } = await createQuery().range(from, to);

    if (error) {
      throw new SchedulerSupabasePageError(
        error.message ?? "Scheduler query failed."
      );
    }

    const page = data ?? [];
    rows.push(...page);
    pages += 1;

    if (page.length < pageSize) {
      return rows;
    }

    from += pageSize;
  }

  throw new SchedulerSupabasePageError(
    "Scheduler query exceeded the page limit without exhausting results."
  );
}
