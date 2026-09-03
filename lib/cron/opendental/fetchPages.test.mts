import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  paginateOpenDental,
  requestOpenDentalPage,
  resolveOpenDentalMaxPages,
  SchedulerOpenDentalError,
} from "./fetchPages.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function config(fetchImpl: typeof fetch) {
  return {
    customerKey: "test-customer-key",
    apiUrl: "https://od.example.test",
    developerKey: "dev-key",
    fetchImpl,
    pageSize: 2,
    maxPages: 5,
    timeoutMs: 1000,
    sleep: async () => undefined,
  };
}

describe("scheduler Open Dental pagination", () => {
  it("walks pages until a short page and does not treat an empty page as failure", async () => {
    const seen: string[] = [];
    const pages = [
      [{ PatNum: 1 }, { PatNum: 2 }],
      [],
    ];
    let calls = 0;

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      seen.push(url);
      const page = pages[calls] ?? [];
      calls += 1;
      return jsonResponse(page);
    };

    const collected: unknown[] = [];
    const summary = await paginateOpenDental(
      config(fetchImpl),
      "/patients/Simple",
      async (page: { PatNum: number }[]) => {
        collected.push(...page);
      }
    );

    assert.equal(summary.pages, 2);
    assert.equal(summary.records, 2);
    assert.deepEqual(collected, [{ PatNum: 1 }, { PatNum: 2 }]);
    assert.match(seen[0], /Limit=2/);
    assert.match(seen[0], /Offset=0/);
  });

  it("continues while pages are full and stops on a short page", async () => {
    const pages = [
      [{ id: 1 }, { id: 2 }],
      [{ id: 3 }],
    ];
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      const page = pages[calls] ?? [];
      calls += 1;
      return jsonResponse(page);
    };

    const collected: number[] = [];
    await paginateOpenDental<{ id: number }>(
      config(fetchImpl),
      "/claims",
      async (page: { id: number }[]) => {
        collected.push(...page.map((row: { id: number }) => row.id));
      }
    );

    assert.deepEqual(collected, [1, 2, 3]);
  });

  it("fails on a non-array payload instead of treating it as empty", async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({ error: "nope" });

    await assert.rejects(
      () =>
        paginateOpenDental(config(fetchImpl), "/claims", async () => undefined),
      (error: unknown) => {
        return (
          error instanceof SchedulerOpenDentalError &&
          error.message.includes("non-array")
        );
      }
    );
  });

  it("fails on malformed JSON", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("not-json", { status: 200 });

    await assert.rejects(
      () => requestOpenDentalPage(config(fetchImpl), "/clinics", 0),
      SchedulerOpenDentalError
    );
  });

  it("fails on a non-2xx response without using the body", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("secret-patient-name", { status: 500 });

    await assert.rejects(
      () => requestOpenDentalPage(config(fetchImpl), "/patients/Simple", 0),
      (error: unknown) => {
        return (
          error instanceof SchedulerOpenDentalError &&
          error.message.includes("500") &&
          !error.message.includes("secret-patient-name")
        );
      }
    );
  });

  it("retries a 429 and then succeeds", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("", { status: 429 });
      }
      return jsonResponse([{ ok: true }]);
    };

    const payload = await requestOpenDentalPage(
      config(fetchImpl),
      "/clinics",
      0
    );
    assert.deepEqual(payload, [{ ok: true }]);
    assert.equal(calls, 2);
  });

  it("does not send the customer key in the URL", async () => {
    let url = "";
    const fetchImpl: typeof fetch = async (input) => {
      url = String(input);
      return jsonResponse([]);
    };

    await requestOpenDentalPage(config(fetchImpl), "/clinics", 0);
    assert.equal(url.includes("test-customer-key"), false);
  });

  it("continues past 100 pages until the endpoint is exhausted", async () => {
    const total = 105;
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get("Offset") ?? "0");
      const limit = Number(url.searchParams.get("Limit") ?? "0");
      const page = [];

      for (let index = 0; index < limit; index += 1) {
        const value = offset + index;
        if (value >= total) {
          break;
        }
        page.push({ id: value });
      }

      return jsonResponse(page);
    };

    const collected: number[] = [];
    const summary = await paginateOpenDental<{ id: number }>(
      {
        ...config(fetchImpl),
        pageSize: 1,
        maxPages: 1_000,
      },
      "/procedurelogs",
      async (page) => {
        collected.push(...page.map((row) => row.id));
      }
    );

    assert.equal(summary.pages, 106);
    assert.equal(summary.records, 105);
    assert.equal(collected.length, 105);
    assert.equal(collected[104], 104);
  });

  it("fails loudly when the safety page limit is reached and does not return partial success", async () => {
    const seenPages: number[] = [];
    const fetchImpl: typeof fetch = async () =>
      jsonResponse([{ id: 1 }, { id: 2 }]);

    await assert.rejects(
      () =>
        paginateOpenDental(
          {
            ...config(fetchImpl),
            pageSize: 2,
            maxPages: 3,
          },
          "/procedurelogs",
          async (page: { id: number }[]) => {
            seenPages.push(page.length);
          }
        ),
      (error: unknown) =>
        error instanceof SchedulerOpenDentalError &&
        error.message.includes("safety page limit")
    );

    assert.deepEqual(seenPages, [2, 2, 2]);
  });
});

describe("resolveOpenDentalMaxPages", () => {
  it("uses an explicit config value before the environment default", () => {
    const previous = process.env.SCHEDULER_OD_MAX_PAGES;
    process.env.SCHEDULER_OD_MAX_PAGES = "7";

    try {
      assert.equal(resolveOpenDentalMaxPages(4), 4);
      assert.equal(resolveOpenDentalMaxPages(), 7);
    } finally {
      if (previous === undefined) {
        delete process.env.SCHEDULER_OD_MAX_PAGES;
      } else {
        process.env.SCHEDULER_OD_MAX_PAGES = previous;
      }
    }
  });

  it("defaults to a circuit breaker rather than a 50,000-row cap", () => {
    const previous = process.env.SCHEDULER_OD_MAX_PAGES;
    delete process.env.SCHEDULER_OD_MAX_PAGES;

    try {
      assert.equal(resolveOpenDentalMaxPages(), 10_000);
    } finally {
      if (previous === undefined) {
        delete process.env.SCHEDULER_OD_MAX_PAGES;
      } else {
        process.env.SCHEDULER_OD_MAX_PAGES = previous;
      }
    }
  });
});
