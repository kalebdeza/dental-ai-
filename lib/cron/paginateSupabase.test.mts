import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  paginateSupabaseQuery,
  SchedulerSupabasePageError,
  SCHEDULER_SUPABASE_PAGE_SIZE,
} from "./paginateSupabase.ts";

function createPagedSource<T>(
  rows: T[],
  options?: { errorAtPage?: number; pageCalls?: Array<[number, number]> }
) {
  let page = 0;

  return () => ({
    range(from: number, to: number) {
      page += 1;
      options?.pageCalls?.push([from, to]);

      if (options?.errorAtPage === page) {
        return Promise.resolve({
          data: null,
          error: { message: "database unavailable" },
        });
      }

      return Promise.resolve({
        data: rows.slice(from, to + 1),
        error: null,
      });
    },
  });
}

describe("paginateSupabaseQuery", () => {
  it("returns no rows for an empty table", async () => {
    const ranges: Array<[number, number]> = [];
    const rows = await paginateSupabaseQuery(
      createPagedSource([], { pageCalls: ranges }),
      { pageSize: 10 }
    );

    assert.deepEqual(rows, []);
    assert.deepEqual(ranges, [[0, 9]]);
  });

  it("returns a single row", async () => {
    const rows = await paginateSupabaseQuery(
      createPagedSource([{ id: "1" }]),
      { pageSize: 10 }
    );

    assert.deepEqual(rows, [{ id: "1" }]);
  });

  it("returns an exact single page without truncating", async () => {
    const source = Array.from({ length: 10 }, (_, index) => ({
      id: String(index + 1),
    }));
    const ranges: Array<[number, number]> = [];
    const rows = await paginateSupabaseQuery(
      createPagedSource(source, { pageCalls: ranges }),
      { pageSize: 10 }
    );

    assert.equal(rows.length, 10);
    assert.equal(ranges.length, 2);
    assert.deepEqual(ranges[0], [0, 9]);
    assert.deepEqual(ranges[1], [10, 19]);
  });

  it("pages past 1,000 rows and does not silently truncate", async () => {
    const source = Array.from({ length: 1500 }, (_, index) => ({
      id: String(index + 1),
    }));
    const ranges: Array<[number, number]> = [];
    const rows = await paginateSupabaseQuery(
      createPagedSource(source, { pageCalls: ranges })
    );

    assert.equal(rows.length, 1500);
    assert.equal(rows[0]?.id, "1");
    assert.equal(rows[1499]?.id, "1500");
    assert.equal(SCHEDULER_SUPABASE_PAGE_SIZE, 1000);
    assert.deepEqual(ranges[0], [0, 999]);
    assert.deepEqual(ranges[1], [1000, 1999]);
    assert.equal(ranges.length, 2);
  });

  it("walks multiple pages ending on a short page", async () => {
    const source = Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
    }));
    const ranges: Array<[number, number]> = [];
    const rows = await paginateSupabaseQuery(
      createPagedSource(source, { pageCalls: ranges }),
      { pageSize: 5 }
    );

    assert.equal(rows.length, 12);
    assert.deepEqual(ranges, [
      [0, 4],
      [5, 9],
      [10, 14],
    ]);
  });

  it("fails loudly on a database error instead of returning a partial page", async () => {
    await assert.rejects(
      () =>
        paginateSupabaseQuery(
          createPagedSource([{ id: "1" }, { id: "2" }], { errorAtPage: 2 }),
          { pageSize: 1 }
        ),
      (error: unknown) =>
        error instanceof SchedulerSupabasePageError &&
        error.message.includes("database unavailable")
    );
  });

  it("fails when results never exhaust within the page limit", async () => {
    const infinite = () => ({
      range() {
        return Promise.resolve({
          data: [{ id: "x" }, { id: "y" }],
          error: null,
        });
      },
    });

    await assert.rejects(
      () => paginateSupabaseQuery(infinite, { pageSize: 2, maxPages: 3 }),
      SchedulerSupabasePageError
    );
  });
});
