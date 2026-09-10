import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildTodayPriorityPatients,
  compareWorkQueueItems,
  filterWorkQueueItems,
  formatQueueLastActivity,
  isClinicallyOverdue,
  isRecoverableOpportunity,
  isTodayQueueItem,
  isWorkQueueEligible,
  recoverableEstimatedTotal,
  selectWorkQueueItems,
  toWorkQueueItem,
  workQueueTabFor,
  type WorkQueueItem,
} from "./workQueue.ts";

const NOW = new Date("2026-09-10T12:00:00.000Z");

function item(overrides: Partial<WorkQueueItem> = {}): WorkQueueItem {
  return toWorkQueueItem({
    id: "opp-1",
    patient: "Ada Lovelace",
    patientId: "patient-1",
    opportunityType: "Recall",
    reason: "Overdue recall",
    estimatedValue: 180,
    priority: "Medium",
    workflowStatus: "open",
    contactOutcome: null,
    snoozedUntil: null,
    identifiedAt: "2026-09-01T00:00:00.000Z",
    lastActedAt: null,
    dueDate: "2026-08-01T00:00:00.000Z",
    completed: false,
    ...overrides,
  });
}

describe("work queue Today tab", () => {
  it("Today includes open", () => {
    assert.equal(isTodayQueueItem(item({ workflowStatus: "open" }), NOW), true);
    assert.equal(workQueueTabFor(item({ workflowStatus: "open" }), NOW), "today");
  });

  it("Today includes contacted", () => {
    assert.equal(
      isTodayQueueItem(item({ workflowStatus: "contacted" }), NOW),
      true
    );
  });

  it("Today excludes completed", () => {
    assert.equal(
      isTodayQueueItem(
        item({ workflowStatus: "completed", completed: true }),
        NOW
      ),
      false
    );
    assert.equal(
      isWorkQueueEligible(item({ workflowStatus: "completed", completed: true })),
      false
    );
  });

  it("Today excludes dismissed", () => {
    assert.equal(
      isTodayQueueItem(item({ workflowStatus: "dismissed" }), NOW),
      false
    );
    assert.equal(isWorkQueueEligible(item({ workflowStatus: "dismissed" })), false);
  });

  it("Today excludes future snoozed", () => {
    assert.equal(
      isTodayQueueItem(
        item({
          workflowStatus: "open",
          snoozedUntil: "2026-09-11T00:00:00.000Z",
        }),
        NOW
      ),
      false
    );
    assert.equal(
      workQueueTabFor(
        item({
          workflowStatus: "open",
          snoozedUntil: "2026-09-11T00:00:00.000Z",
        }),
        NOW
      ),
      "snoozed"
    );
  });

  it("Scheduled appears in Scheduled", () => {
    assert.equal(
      workQueueTabFor(item({ workflowStatus: "scheduled" }), NOW),
      "scheduled"
    );
    assert.equal(
      isTodayQueueItem(item({ workflowStatus: "scheduled" }), NOW),
      false
    );
  });

  it("Snoozed appears in Snoozed", () => {
    const snoozed = item({
      workflowStatus: "contacted",
      snoozedUntil: "2026-09-20T00:00:00.000Z",
    });
    assert.equal(workQueueTabFor(snoozed, NOW), "snoozed");
    assert.deepEqual(
      filterWorkQueueItems([snoozed], "snoozed", NOW).map((row) => row.id),
      ["opp-1"]
    );
  });

  it("snooze expiration returns item to Today", () => {
    const row = item({
      workflowStatus: "open",
      snoozedUntil: "2026-09-10T11:00:00.000Z",
    });
    assert.equal(workQueueTabFor(row, NOW), "today");
    assert.equal(
      workQueueTabFor(row, new Date("2026-09-10T10:00:00.000Z")),
      "snoozed"
    );
  });

  it("scheduled is NOT treated as completed/recovered", () => {
    const scheduled = item({ workflowStatus: "scheduled", completed: false });
    assert.equal(workQueueTabFor(scheduled, NOW), "scheduled");
    assert.equal(isTodayQueueItem(scheduled, NOW), false);
    assert.equal(isRecoverableOpportunity(scheduled), true);
    assert.equal(scheduled.completed, false);
    assert.notEqual(scheduled.workflowStatus, "completed");
  });
});

describe("work queue ranking", () => {
  it("Recall overdue sorting", () => {
    const overdue = item({
      id: "overdue",
      dueDate: "2026-01-01T00:00:00.000Z",
      priority: "Low",
      estimatedValue: 10,
    });
    const current = item({
      id: "current",
      dueDate: "2026-12-01T00:00:00.000Z",
      priority: "High",
      estimatedValue: 900,
    });
    assert.equal(isClinicallyOverdue(overdue, NOW), true);
    assert.equal(isClinicallyOverdue(current, NOW), false);
    assert.equal(compareWorkQueueItems(overdue, current, NOW) < 0, true);
    assert.equal(selectWorkQueueItems([current, overdue], "today", NOW)[0]?.id, "overdue");
  });

  it("does not label treatment overdue", () => {
    const treatment = item({
      opportunityType: "Treatment",
      dueDate: "2026-01-01T00:00:00.000Z",
      identifiedAt: "2025-01-01T00:00:00.000Z",
    });
    assert.equal(isClinicallyOverdue(treatment, NOW), false);
  });

  it("uses claim aging when submitted_at is 30+ days and remaining_balance > 0", () => {
    const aging = item({
      opportunityType: "Claim",
      dueDate: null,
      claimSubmittedAt: "2026-08-01T00:00:00.000Z",
      claimRemainingBalance: 400,
    });
    const recent = item({
      id: "recent-claim",
      opportunityType: "Claim",
      dueDate: null,
      claimSubmittedAt: "2026-09-09T00:00:00.000Z",
      claimRemainingBalance: 400,
      priority: "High",
    });
    assert.equal(isClinicallyOverdue(aging, NOW), true);
    assert.equal(isClinicallyOverdue(recent, NOW), false);
    assert.equal(compareWorkQueueItems(aging, recent, NOW) < 0, true);
  });

  it("High > Medium > Low priority", () => {
    const low = item({ id: "low", priority: "Low", dueDate: null });
    const medium = item({ id: "medium", priority: "Medium", dueDate: null });
    const high = item({ id: "high", priority: "High", dueDate: null });
    const ordered = selectWorkQueueItems([low, medium, high], "today", NOW);
    assert.deepEqual(
      ordered.map((row) => row.id),
      ["high", "medium", "low"]
    );
  });

  it("estimated_value tie-breaking", () => {
    const cheaper = item({
      id: "cheap",
      priority: "High",
      estimatedValue: 100,
      dueDate: null,
    });
    const richer = item({
      id: "rich",
      priority: "High",
      estimatedValue: 400,
      dueDate: null,
    });
    assert.equal(compareWorkQueueItems(richer, cheaper, NOW) < 0, true);
    assert.equal(
      selectWorkQueueItems([cheaper, richer], "today", NOW)[0]?.id,
      "rich"
    );
  });

  it("identified_at final tie-break", () => {
    const newer = item({
      id: "newer",
      priority: "High",
      estimatedValue: 200,
      identifiedAt: "2026-09-08T00:00:00.000Z",
      dueDate: null,
    });
    const older = item({
      id: "older",
      priority: "High",
      estimatedValue: 200,
      identifiedAt: "2026-09-01T00:00:00.000Z",
      dueDate: null,
    });
    assert.equal(compareWorkQueueItems(older, newer, NOW) < 0, true);
    assert.equal(
      selectWorkQueueItems([newer, older], "today", NOW)[0]?.id,
      "older"
    );
  });
});

describe("opportunities type filter and last activity", () => {
  it("Opportunities type filter", () => {
    const rows = [
      item({ id: "r", opportunityType: "Recall" }),
      item({ id: "t", opportunityType: "Treatment", dueDate: null }),
      item({ id: "c", opportunityType: "Claim", dueDate: null }),
    ];
    assert.deepEqual(
      filterWorkQueueItems(rows, "today", NOW, "Treatment").map((row) => row.id),
      ["t"]
    );
    assert.deepEqual(
      filterWorkQueueItems(rows, "today", NOW, "Claim").map((row) => row.id),
      ["c"]
    );
  });

  it("shows stored contact outcome or last acted time and does not invent history", () => {
    assert.equal(
      formatQueueLastActivity(item({ contactOutcome: null, lastActedAt: null })),
      null
    );
    assert.match(
      formatQueueLastActivity(
        item({
          contactOutcome: "left_voicemail",
          lastActedAt: "2026-09-09T15:00:00.000Z",
        })
      ) ?? "",
      /Left voicemail/
    );
  });
});

describe("dashboard Today rules and recoverable revenue", () => {
  it("dashboard highest-priority list follows Today rules", () => {
    const rows = [
      item({
        id: "dismissed",
        workflowStatus: "dismissed",
        priority: "High",
        estimatedValue: 9000,
      }),
      item({
        id: "completed",
        workflowStatus: "completed",
        completed: true,
        priority: "High",
        estimatedValue: 8000,
      }),
      item({
        id: "snoozed",
        snoozedUntil: "2026-09-20T00:00:00.000Z",
        priority: "High",
        estimatedValue: 7000,
      }),
      item({
        id: "scheduled",
        workflowStatus: "scheduled",
        priority: "High",
        estimatedValue: 6000,
        dueDate: null,
      }),
      item({
        id: "today-low",
        workflowStatus: "open",
        priority: "Low",
        estimatedValue: 50,
        dueDate: null,
      }),
      item({
        id: "today-high",
        workflowStatus: "contacted",
        priority: "High",
        estimatedValue: 300,
        dueDate: null,
      }),
    ];
    const ranked = buildTodayPriorityPatients(rows, NOW, 5);
    assert.deepEqual(
      ranked.map((row) => row.opportunityId),
      ["today-high", "today-low"]
    );
  });

  it("dismissed opportunities excluded from recoverable revenue", () => {
    const rows = [
      item({
        id: "open",
        estimatedValue: 100,
        workflowStatus: "open",
      }),
      item({
        id: "dismissed",
        estimatedValue: 500,
        workflowStatus: "dismissed",
      }),
      item({
        id: "scheduled",
        estimatedValue: 40,
        workflowStatus: "scheduled",
      }),
    ];
    assert.equal(recoverableEstimatedTotal(rows), 140);
    assert.equal(isRecoverableOpportunity(item({ workflowStatus: "dismissed" })), false);
    assert.equal(isRecoverableOpportunity(item({ workflowStatus: "scheduled" })), true);
  });
});

describe("work queue UI and tenant isolation", () => {
  it("Opportunity row links to /opportunities/[id]", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../app/opportunities/page.tsx", import.meta.url)),
      "utf8"
    );
    assert.match(source, /\/opportunities\/\$\{/);
    assert.doesNotMatch(source, /Total Recoverable Revenue/);
  });

  it("tenant isolation remains intact", () => {
    for (const relative of [
      "../../app/api/recall/route.ts",
      "../../app/api/treatment/route.ts",
      "../../app/api/opportunities/route.ts",
      "../../app/api/dashboard/route.ts",
    ]) {
      const source = readFileSync(
        fileURLToPath(new URL(relative, import.meta.url)),
        "utf8"
      );
      assert.match(source, /requirePractice/);
      assert.match(source, /\.eq\("practice_id", practice\.id\)/);
      assert.doesNotMatch(source, /searchParams\.get\("practice_id"\)/);
    }

    const dashboard = readFileSync(
      fileURLToPath(new URL("../../app/api/dashboard/route.ts", import.meta.url)),
      "utf8"
    );
    assert.match(dashboard, /isRecoverableOpportunity/);
    assert.match(dashboard, /buildTodayPriorityPatients/);

    const claimsPage = readFileSync(
      fileURLToPath(new URL("../../app/claims/page.tsx", import.meta.url)),
      "utf8"
    );
    assert.match(claimsPage, /getClaims/);
    assert.doesNotMatch(claimsPage, /WorkQueueBoard/);
  });

  it("queue pages keep estimated dollars unlabeled as recovered", () => {
    for (const relative of [
      "../../app/components/WorkQueueBoard.tsx",
      "../../app/recall/page.tsx",
      "../../app/treatment/page.tsx",
      "../../app/opportunities/page.tsx",
    ]) {
      const source = readFileSync(
        fileURLToPath(new URL(relative, import.meta.url)),
        "utf8"
      );
      assert.doesNotMatch(source, /guaranteed/i);
      assert.doesNotMatch(source, /scheduled revenue/i);
    }
  });
});
