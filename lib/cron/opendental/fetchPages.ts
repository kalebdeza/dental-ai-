export const SCHEDULER_OD_PAGE_SIZE = 100;
export const SCHEDULER_OD_DEFAULT_MAX_PAGES = 10_000;
export const SCHEDULER_OD_TIMEOUT_MS = 20_000;
export const SCHEDULER_OD_MAX_RETRIES = 3;

/**
 * Circuit breaker against infinite Offset pagination, not a target office size.
 * Override with config.maxPages or SCHEDULER_OD_MAX_PAGES.
 * Hitting this limit fails the request; it does not return a partial success.
 *
 * A single cron invocation is still bounded by maxDuration. Offices whose
 * /procedurelogs history cannot finish inside that window will fail the sync
 * without stamping last_sync_at; upserts already written are idempotent on
 * retry. The existing Open Dental client only supports Limit/Offset, so this
 * layer does not invent incremental filters.
 */
export function resolveOpenDentalMaxPages(explicit?: number): number {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return Math.floor(explicit);
  }

  const fromEnv = Number(process.env.SCHEDULER_OD_MAX_PAGES);

  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv);
  }

  return SCHEDULER_OD_DEFAULT_MAX_PAGES;
}

export class SchedulerOpenDentalError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "SchedulerOpenDentalError";
    this.status = status;
  }
}

export type SchedulerOpenDentalRequest = {
  customerKey: string;
  apiUrl: string;
  developerKey: string;
  fetchImpl?: typeof fetch;
  pageSize?: number;
  timeoutMs?: number;
  maxPages?: number;
  sleep?: (ms: number) => Promise<void>;
};

function sleepDefault(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function authorizationHeader(
  developerKey: string,
  customerKey: string
): string {
  return `ODFHIR ${developerKey}/${customerKey}`;
}

export async function requestOpenDentalPage(
  config: SchedulerOpenDentalRequest,
  endpoint: string,
  offset: number,
  extraParams?: Record<string, string | number | boolean | undefined>
): Promise<unknown> {
  const apiUrl = config.apiUrl.replace(/\/$/, "");
  const url = new URL(`${apiUrl}${endpoint}`);
  const pageSize = config.pageSize ?? SCHEDULER_OD_PAGE_SIZE;
  const timeoutMs = config.timeoutMs ?? SCHEDULER_OD_TIMEOUT_MS;
  const fetchImpl = config.fetchImpl ?? fetch;
  const sleep = config.sleep ?? sleepDefault;

  url.searchParams.set("Limit", String(pageSize));
  url.searchParams.set("Offset", String(offset));

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= SCHEDULER_OD_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;

    try {
      response = await fetchImpl(url.toString(), {
        method: "GET",
        headers: {
          Authorization: authorizationHeader(
            config.developerKey,
            config.customerKey
          ),
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);

      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.message.includes("timed out"))
      ) {
        throw new SchedulerOpenDentalError(
          `Open Dental request timed out after ${timeoutMs}ms.`
        );
      }

      throw new SchedulerOpenDentalError("Open Dental network request failed.");
    } finally {
      clearTimeout(timeout);
    }

    lastStatus = response.status;

    if (response.status === 429 && attempt < SCHEDULER_OD_MAX_RETRIES) {
      await sleep(attempt * 1000);
      continue;
    }

    if (!response.ok) {
      throw new SchedulerOpenDentalError(
        `Open Dental request failed (${response.status}).`,
        response.status
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new SchedulerOpenDentalError(
        "Open Dental returned a malformed JSON response.",
        response.status
      );
    }

    return payload;
  }

  throw new SchedulerOpenDentalError(
    `Open Dental request failed (${lastStatus ?? "unknown"}).`,
    lastStatus
  );
}

export async function paginateOpenDental<T>(
  config: SchedulerOpenDentalRequest,
  endpoint: string,
  onPage: (page: T[]) => Promise<void>,
  extraParams?: Record<string, string | number | boolean | undefined>
): Promise<{ pages: number; records: number }> {
  const pageSize = config.pageSize ?? SCHEDULER_OD_PAGE_SIZE;
  const maxPages = resolveOpenDentalMaxPages(config.maxPages);
  let offset = 0;
  let pages = 0;
  let records = 0;

  while (pages < maxPages) {
    const payload = await requestOpenDentalPage(
      config,
      endpoint,
      offset,
      extraParams
    );

    if (!Array.isArray(payload)) {
      throw new SchedulerOpenDentalError(
        `Open Dental ${endpoint} returned a non-array response.`
      );
    }

    const page = payload as T[];
    pages += 1;
    records += page.length;

    if (page.length > 0) {
      await onPage(page);
    }

    if (page.length < pageSize) {
      return { pages, records };
    }

    offset += pageSize;
  }

  throw new SchedulerOpenDentalError(
    `Open Dental ${endpoint} exceeded the safety page limit (${maxPages} pages). Results are incomplete.`
  );
}

export async function collectOpenDentalPages<T>(
  config: SchedulerOpenDentalRequest,
  endpoint: string,
  extraParams?: Record<string, string | number | boolean | undefined>
): Promise<T[]> {
  const rows: T[] = [];

  await paginateOpenDental<T>(
    config,
    endpoint,
    async (page) => {
      rows.push(...page);
    },
    extraParams
  );

  return rows;
}
