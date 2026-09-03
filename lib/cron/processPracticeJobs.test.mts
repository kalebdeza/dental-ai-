import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import type { PracticeJobDue } from "./due.ts";
import { runPracticeJobSequence } from "./runPracticeJobSequence.ts";
import {
  PRACTICE_JOB_LOCK_TTL_SECONDS,
  PRACTICE_JOB_MAX_DURATION_SECONDS,
} from "./timeout.ts";

function allDue(): PracticeJobDue {
  return {
    sync: true,
    claim: true,
    recall: true,
    treatment: true,
  };
}

describe("practice job sequence", () => {
  it("skips claim, recall, and treatment when sync fails", async () => {
    const ran: string[] = [];

    await runPracticeJobSequence(allDue(), {
      sync: async () => {
        ran.push("sync");
        return { status: "failed" };
      },
      claim: async () => {
        ran.push("claim");
        return { status: "succeeded" };
      },
      recall: async () => {
        ran.push("recall");
        return { status: "succeeded" };
      },
      treatment: async () => {
        ran.push("treatment");
        return { status: "succeeded" };
      },
    });

    assert.deepEqual(ran, ["sync"]);
  });

  it("skips scans when sync is not implemented", async () => {
    const ran: string[] = [];

    await runPracticeJobSequence(allDue(), {
      sync: async () => {
        ran.push("sync");
        return { status: "not_implemented" };
      },
      claim: async () => {
        ran.push("claim");
        return { status: "succeeded" };
      },
      recall: async () => {
        ran.push("recall");
        return { status: "succeeded" };
      },
      treatment: async () => {
        ran.push("treatment");
        return { status: "succeeded" };
      },
    });

    assert.deepEqual(ran, ["sync"]);
  });

  it("runs sync then claim then recall then treatment when all succeed", async () => {
    const ran: string[] = [];

    await runPracticeJobSequence(allDue(), {
      sync: async () => {
        ran.push("sync");
        return { status: "succeeded" };
      },
      claim: async () => {
        ran.push("claim");
        return { status: "succeeded" };
      },
      recall: async () => {
        ran.push("recall");
        return { status: "succeeded" };
      },
      treatment: async () => {
        ran.push("treatment");
        return { status: "succeeded" };
      },
    });

    assert.deepEqual(ran, ["sync", "claim", "recall", "treatment"]);
  });

  it("runs scans when sync is not due", async () => {
    const ran: string[] = [];

    await runPracticeJobSequence(
      {
        sync: false,
        claim: true,
        recall: true,
        treatment: true,
      },
      {
        sync: async () => {
          ran.push("sync");
          return { status: "succeeded" };
        },
        claim: async () => {
          ran.push("claim");
          return { status: "succeeded" };
        },
        recall: async () => {
          ran.push("recall");
          return { status: "succeeded" };
        },
        treatment: async () => {
          ran.push("treatment");
          return { status: "succeeded" };
        },
      }
    );

    assert.deepEqual(ran, ["claim", "recall", "treatment"]);
  });

  it("continues to recall and treatment after a claim throw", async () => {
    const ran: string[] = [];

    await runPracticeJobSequence(allDue(), {
      sync: async () => {
        ran.push("sync");
        return { status: "succeeded" };
      },
      claim: async () => {
        ran.push("claim");
        throw new Error("claim failed");
      },
      recall: async () => {
        ran.push("recall");
        return { status: "succeeded" };
      },
      treatment: async () => {
        ran.push("treatment");
        return { status: "succeeded" };
      },
    });

    assert.deepEqual(ran, ["sync", "claim", "recall", "treatment"]);
  });

  it("continues to recall and treatment after a claim failed status", async () => {
    const ran: string[] = [];

    await runPracticeJobSequence(allDue(), {
      sync: async () => {
        ran.push("sync");
        return { status: "succeeded" };
      },
      claim: async () => {
        ran.push("claim");
        return { status: "failed" };
      },
      recall: async () => {
        ran.push("recall");
        return { status: "succeeded" };
      },
      treatment: async () => {
        ran.push("treatment");
        return { status: "succeeded" };
      },
    });

    assert.deepEqual(ran, ["sync", "claim", "recall", "treatment"]);
  });

  it("continues after a treatment throw and does not crash", async () => {
    const ran: string[] = [];

    await runPracticeJobSequence(allDue(), {
      sync: async () => {
        ran.push("sync");
        return { status: "succeeded" };
      },
      claim: async () => {
        ran.push("claim");
        return { status: "succeeded" };
      },
      recall: async () => {
        ran.push("recall");
        return { status: "succeeded" };
      },
      treatment: async () => {
        ran.push("treatment");
        throw new Error("treatment failed");
      },
    });

    assert.deepEqual(ran, ["sync", "claim", "recall", "treatment"]);
  });

  it("continues to treatment after a recall throw", async () => {
    const ran: string[] = [];

    await runPracticeJobSequence(allDue(), {
      sync: async () => {
        ran.push("sync");
        return { status: "succeeded" };
      },
      claim: async () => {
        ran.push("claim");
        return { status: "succeeded" };
      },
      recall: async () => {
        ran.push("recall");
        throw new Error("recall failed");
      },
      treatment: async () => {
        ran.push("treatment");
        return { status: "succeeded" };
      },
    });

    assert.deepEqual(ran, ["sync", "claim", "recall", "treatment"]);
  });
});

describe("practice job timeout", () => {
  it("keeps the lock TTL strictly longer than maxDuration", () => {
    assert.equal(PRACTICE_JOB_MAX_DURATION_SECONDS, 300);
    assert.ok(
      PRACTICE_JOB_LOCK_TTL_SECONDS > PRACTICE_JOB_MAX_DURATION_SECONDS
    );
  });

  it("keeps the route maxDuration literal aligned with the timeout source of truth", async () => {
    const route = await readFile(
      new URL("../../app/api/cron/practice-jobs/route.ts", import.meta.url),
      "utf8"
    );

    assert.match(
      route,
      new RegExp(
        `export const maxDuration = ${PRACTICE_JOB_MAX_DURATION_SECONDS};`
      )
    );
  });

  it("keeps per-practice locks and does not let the HTTP caller choose a practice", async () => {
    const lock = await readFile(
      new URL("./practiceJobLock.ts", import.meta.url),
      "utf8"
    );
    const route = await readFile(
      new URL("../../app/api/cron/practice-jobs/route.ts", import.meta.url),
      "utf8"
    );

    assert.match(lock, /practice-job:\$\{practiceId\}/);
    assert.match(lock, /practice-jobs:integration-cursor/);
    assert.equal(route.includes("searchParams"), false);
    assert.match(route, /acquirePracticeJobLock\(integration\.practice_id\)/);
    assert.match(
      route,
      /practiceId: integration\.practice_id/
    );
    assert.match(route, /integrationId: integration\.id/);
  });
});
