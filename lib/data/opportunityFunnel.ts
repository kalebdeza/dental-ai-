import { paginateSupabaseQuery } from "../cron/paginateSupabase.ts";
import {
  isCloseReason,
  isWorkflowStatus,
  type CloseReason,
  type OpportunityActivityRow,
  type WorkflowEventType,
} from "./opportunityWorkflow.ts";

export const FUNNEL_OPEN_STATUSES = ["open", "contacted", "scheduled"] as const;

export const OFFICE_COMPLETED_ACTIVITY_EVENTS = [
  "complete",
  "status_change",
] as const satisfies readonly WorkflowEventType[];

export type OpportunityFunnelRow = {
  id: string;
  practice_id: string;
  patient_id: string | null;
  identified_at: string;
  identified_estimated_value: number;
  workflow_status: string;
  close_reason: string | null;
};

export type OpportunityFunnelActivity = Pick<
  OpportunityActivityRow,
  "opportunity_id" | "event_type" | "to_status" | "created_at"
>;

export type OpportunityLifecycle = {
  opportunityId: string;
  identifiedAt: string;
  contactedAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
};

export type OpportunityFunnelStage = {
  count: number;
  patientCount: number;
  estimatedValue: number;
};

export type OpportunityFunnelMetrics = {
  identified: OpportunityFunnelStage;
  contacted: OpportunityFunnelStage;
  scheduled: OpportunityFunnelStage;
  officeCompleted: OpportunityFunnelStage;
  officeDismissedCount: number;
  scannerClosedCount: number;
  openPipeline: OpportunityFunnelStage;
};

export type OpportunityFunnelClient = {
  from: (table: string) => any;
};

const EMPTY_STAGE: OpportunityFunnelStage = {
  count: 0,
  patientCount: 0,
  estimatedValue: 0,
};

function emptyMetrics(): OpportunityFunnelMetrics {
  return {
    identified: { ...EMPTY_STAGE },
    contacted: { ...EMPTY_STAGE },
    scheduled: { ...EMPTY_STAGE },
    officeCompleted: { ...EMPTY_STAGE },
    officeDismissedCount: 0,
    scannerClosedCount: 0,
    openPipeline: { ...EMPTY_STAGE },
  };
}

function estimatedValue(row: OpportunityFunnelRow): number {
  const value = Number(row.identified_estimated_value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function uniquePatientCount(rows: OpportunityFunnelRow[]): number {
  return new Set(
    rows
      .map((row) => row.patient_id?.trim())
      .filter((patientId): patientId is string => Boolean(patientId))
  ).size;
}

function stageFrom(rows: OpportunityFunnelRow[]): OpportunityFunnelStage {
  return {
    count: rows.length,
    patientCount: uniquePatientCount(rows),
    estimatedValue: rows.reduce((sum, row) => sum + estimatedValue(row), 0),
  };
}

function isOfficeCompletedActivity(activity: OpportunityFunnelActivity): boolean {
  return (
    activity.to_status === "completed" &&
    (OFFICE_COMPLETED_ACTIVITY_EVENTS as readonly string[]).includes(
      activity.event_type
    )
  );
}

export function firstActivityAt(
  activities: OpportunityFunnelActivity[],
  opportunityId: string,
  predicate: (activity: OpportunityFunnelActivity) => boolean
): string | null {
  const matches = activities
    .filter(
      (activity) =>
        activity.opportunity_id === opportunityId && predicate(activity)
    )
    .sort((left, right) => left.created_at.localeCompare(right.created_at));

  return matches[0]?.created_at ?? null;
}

export function readOpportunityLifecycle(
  row: OpportunityFunnelRow,
  activities: OpportunityFunnelActivity[]
): OpportunityLifecycle {
  return {
    opportunityId: row.id,
    identifiedAt: row.identified_at,
    contactedAt: firstActivityAt(
      activities,
      row.id,
      (activity) => activity.to_status === "contacted"
    ),
    scheduledAt: firstActivityAt(
      activities,
      row.id,
      (activity) => activity.to_status === "scheduled"
    ),
    completedAt: firstActivityAt(activities, row.id, isOfficeCompletedActivity),
  };
}

export function buildOpportunityFunnelMetrics(
  opportunities: OpportunityFunnelRow[],
  activities: OpportunityFunnelActivity[]
): OpportunityFunnelMetrics {
  const unique = new Map<string, OpportunityFunnelRow>();

  for (const row of opportunities) {
    if (!row.id || unique.has(row.id)) {
      continue;
    }

    unique.set(row.id, row);
  }

  const rows = [...unique.values()];
  const metrics = emptyMetrics();

  if (rows.length === 0) {
    return metrics;
  }

  const contacted: OpportunityFunnelRow[] = [];
  const scheduled: OpportunityFunnelRow[] = [];
  const officeCompleted: OpportunityFunnelRow[] = [];
  const openPipeline: OpportunityFunnelRow[] = [];

  for (const row of rows) {
    const lifecycle = readOpportunityLifecycle(row, activities);
    const closeReason: CloseReason | null = isCloseReason(row.close_reason)
      ? row.close_reason
      : null;

    if (lifecycle.contactedAt) {
      contacted.push(row);
    }

    if (lifecycle.scheduledAt) {
      scheduled.push(row);
    }

    if (closeReason === "office_completed") {
      officeCompleted.push(row);
    } else if (closeReason === "office_dismissed") {
      metrics.officeDismissedCount += 1;
    } else if (closeReason === "scanner_closed") {
      metrics.scannerClosedCount += 1;
    }

    const status = isWorkflowStatus(row.workflow_status)
      ? row.workflow_status
      : null;

    if (
      status &&
      (FUNNEL_OPEN_STATUSES as readonly string[]).includes(status)
    ) {
      openPipeline.push(row);
    }
  }

  return {
    identified: stageFrom(rows),
    contacted: stageFrom(contacted),
    scheduled: stageFrom(scheduled),
    officeCompleted: stageFrom(officeCompleted),
    officeDismissedCount: metrics.officeDismissedCount,
    scannerClosedCount: metrics.scannerClosedCount,
    openPipeline: stageFrom(openPipeline),
  };
}

export function assertNoRecoveredRevenue(
  metrics: OpportunityFunnelMetrics
): void {
  const serialized = JSON.stringify(metrics);

  if (
    /recovered|roi|payment/i.test(serialized) ||
    "recoveredRevenue" in metrics ||
    "revenueRecovered" in metrics
  ) {
    throw new Error("Recovered revenue must not be calculated.");
  }
}

export async function loadOpportunityFunnelMetrics(
  client: OpportunityFunnelClient,
  practiceId: string
): Promise<OpportunityFunnelMetrics> {
  if (!practiceId.trim()) {
    throw new Error("Practice id is required.");
  }

  const opportunities = await paginateSupabaseQuery<OpportunityFunnelRow>(() =>
    client
      .from("revenue_opportunities")
      .select(
        "id, practice_id, patient_id, identified_at, identified_estimated_value, workflow_status, close_reason"
      )
      .eq("practice_id", practiceId)
      .order("id")
  );

  const scoped = opportunities.filter(
    (row): row is OpportunityFunnelRow =>
      Boolean(row?.id) && row.practice_id === practiceId
  );

  const activities = await paginateSupabaseQuery<OpportunityFunnelActivity>(
    () =>
      client
        .from("opportunity_activities")
        .select("opportunity_id, event_type, to_status, created_at")
        .eq("practice_id", practiceId)
        .order("created_at")
  );

  const metrics = buildOpportunityFunnelMetrics(scoped, activities);
  assertNoRecoveredRevenue(metrics);
  return metrics;
}
