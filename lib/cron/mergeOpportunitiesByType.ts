import { logger } from "../api/logger.ts";
import { paginateSupabaseQuery } from "./paginateSupabase.ts";
import type { SchedulerPracticeContext } from "./schedulerContext.ts";

export const SCHEDULER_OPPORTUNITY_TYPES = [
  "Claim",
  "Recall",
  "Treatment",
] as const;

export type SchedulerOpportunityType =
  (typeof SCHEDULER_OPPORTUNITY_TYPES)[number];

export type MergeCandidate = {
  patient_id?: string | null;
  claim_id?: string | null;
  procedure_id?: string | null;
  recall_id?: string | null;
  priority: string;
  estimated_value: number;
  confidence_score?: number | null;
  reason?: string | null;
  recommended_action?: string | null;
  claim_outstanding?: boolean;
};

export type ExistingOpportunity = {
  id: string;
  practice_id: string;
  opportunity_type: string;
  patient_id: string | null;
  claim_id: string | null;
  procedure_id: string | null;
  recall_id: string | null;
  completed: boolean;
  priority: string;
  estimated_value: number;
  confidence_score: number | null;
  reason: string | null;
  recommended_action: string | null;
  workflow_status?: string | null;
  contact_outcome?: string | null;
  snoozed_until?: string | null;
  last_actor_user_id?: string | null;
  last_acted_at?: string | null;
};

export type ScannerOwnedFields = {
  reason: string | null;
  recommended_action: string | null;
  estimated_value: number;
  priority: string;
  confidence_score: number | null;
};

export type PlannedInsert = MergeCandidate & {
  recall_id: string | null;
  claim_id: string | null;
  procedure_id: string | null;
  patient_id: string | null;
};

export type PlannedUpdate = {
  id: string;
  fields: ScannerOwnedFields;
};

export type PlannedCompletion = {
  id: string;
  preserve: {
    workflow_status?: string | null;
    contact_outcome?: string | null;
    snoozed_until?: string | null;
    last_actor_user_id?: string | null;
    last_acted_at?: string | null;
  };
};

export type OpportunityMergePlan = {
  inserts: PlannedInsert[];
  updates: PlannedUpdate[];
  completions: PlannedCompletion[];
  droppedUnkeyed: number;
};

const INSERT_CHUNK = 500;
const UPDATE_CHUNK = 500;

export function isSchedulerOpportunityType(
  value: string
): value is SchedulerOpportunityType {
  return (SCHEDULER_OPPORTUNITY_TYPES as readonly string[]).includes(value);
}

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function opportunityNaturalKey(
  opportunityType: SchedulerOpportunityType,
  row: {
    recall_id?: string | null;
    claim_id?: string | null;
    procedure_id?: string | null;
  }
): string | null {
  if (opportunityType === "Recall") {
    const recallId = present(row.recall_id);
    return recallId ? `recall:${recallId}` : null;
  }

  if (opportunityType === "Treatment") {
    const procedureId = present(row.procedure_id);
    return procedureId ? `treatment:${procedureId}` : null;
  }

  const claimId = present(row.claim_id);
  if (claimId) {
    return `claim:${claimId}`;
  }

  const procedureId = present(row.procedure_id);
  return procedureId ? `claim-proc:${procedureId}` : null;
}

function officeStatus(row: ExistingOpportunity): string {
  const status = row.workflow_status?.trim();

  if (
    status === "dismissed" ||
    status === "contacted" ||
    status === "scheduled" ||
    status === "completed" ||
    status === "open"
  ) {
    return status;
  }

  return row.completed ? "completed" : "open";
}

function scannerFields(candidate: MergeCandidate): ScannerOwnedFields {
  return {
    reason: candidate.reason ?? null,
    recommended_action: candidate.recommended_action ?? null,
    estimated_value: Number(candidate.estimated_value ?? 0),
    priority: candidate.priority,
    confidence_score: candidate.confidence_score ?? null,
  };
}

function preferClaimCandidate(
  current: MergeCandidate,
  incoming: MergeCandidate
): MergeCandidate {
  if (incoming.claim_outstanding && !current.claim_outstanding) {
    return incoming;
  }

  return current;
}

export function dedupeMergeCandidates(
  opportunityType: SchedulerOpportunityType,
  candidates: MergeCandidate[]
): { keyed: Map<string, MergeCandidate>; droppedUnkeyed: number } {
  const keyed = new Map<string, MergeCandidate>();
  let droppedUnkeyed = 0;

  for (const candidate of candidates) {
    const key = opportunityNaturalKey(opportunityType, candidate);

    if (!key) {
      droppedUnkeyed += 1;
      continue;
    }

    const existing = keyed.get(key);

    if (!existing) {
      keyed.set(key, candidate);
      continue;
    }

    keyed.set(
      key,
      opportunityType === "Claim" && key.startsWith("claim:")
        ? preferClaimCandidate(existing, candidate)
        : existing
    );
  }

  return { keyed, droppedUnkeyed };
}

export function planOpportunityMerge(
  opportunityType: SchedulerOpportunityType,
  existing: ExistingOpportunity[],
  candidates: MergeCandidate[]
): OpportunityMergePlan {
  const { keyed: incoming, droppedUnkeyed } = dedupeMergeCandidates(
    opportunityType,
    candidates
  );

  const existingByKey = new Map<string, ExistingOpportunity>();
  const unkeyedExisting: ExistingOpportunity[] = [];

  for (const row of existing) {
    const key = opportunityNaturalKey(opportunityType, row);

    if (!key) {
      unkeyedExisting.push(row);
      continue;
    }

    existingByKey.set(key, row);
  }

  void unkeyedExisting;

  const inserts: PlannedInsert[] = [];
  const updates: PlannedUpdate[] = [];
  const completions: PlannedCompletion[] = [];

  for (const [key, candidate] of incoming) {
    const match = existingByKey.get(key);

    if (!match) {
      inserts.push({
        ...candidate,
        patient_id: present(candidate.patient_id),
        recall_id: present(candidate.recall_id),
        claim_id: present(candidate.claim_id),
        procedure_id: present(candidate.procedure_id),
      });
      continue;
    }

    existingByKey.delete(key);

    const status = officeStatus(match);

    if (status === "dismissed" || status === "completed") {
      updates.push({ id: match.id, fields: scannerFields(candidate) });
      continue;
    }

    updates.push({ id: match.id, fields: scannerFields(candidate) });
  }

  for (const leftover of existingByKey.values()) {
    const status = officeStatus(leftover);

    if (status === "dismissed" || status === "completed") {
      continue;
    }

    completions.push({
      id: leftover.id,
      preserve: {
        workflow_status: leftover.workflow_status ?? null,
        contact_outcome: leftover.contact_outcome ?? null,
        snoozed_until: leftover.snoozed_until ?? null,
        last_actor_user_id: leftover.last_actor_user_id ?? null,
        last_acted_at: leftover.last_acted_at ?? null,
      },
    });
  }

  return { inserts, updates, completions, droppedUnkeyed };
}

type MergeClient = {
  from: SchedulerPracticeContext["supabase"]["from"];
};

export const EXISTING_OPPORTUNITY_COLUMNS =
  "id, practice_id, opportunity_type, patient_id, claim_id, procedure_id, recall_id, completed, workflow_status, contact_outcome, snoozed_until, last_actor_user_id, last_acted_at, priority, estimated_value, confidence_score, reason, recommended_action";

async function loadExistingOpportunities(
  supabase: MergeClient,
  practiceId: string,
  opportunityType: SchedulerOpportunityType
): Promise<ExistingOpportunity[]> {
  return paginateSupabaseQuery<ExistingOpportunity>(() =>
    supabase
      .from("revenue_opportunities")
      .select(EXISTING_OPPORTUNITY_COLUMNS)
      .eq("practice_id", practiceId)
      .eq("opportunity_type", opportunityType)
      .order("id")
  );
}

async function updateScannerFields(
  supabase: MergeClient,
  practiceId: string,
  updates: PlannedUpdate[]
): Promise<void> {
  for (let index = 0; index < updates.length; index += UPDATE_CHUNK) {
    const chunk = updates.slice(index, index + UPDATE_CHUNK);

    for (const update of chunk) {
      const { error } = await supabase
        .from("revenue_opportunities")
        .update({
          reason: update.fields.reason,
          recommended_action: update.fields.recommended_action,
          estimated_value: update.fields.estimated_value,
          priority: update.fields.priority,
          confidence_score: update.fields.confidence_score,
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.id)
        .eq("practice_id", practiceId);

      if (error) {
        throw error;
      }
    }
  }
}

async function completeOpportunities(
  supabase: MergeClient,
  practiceId: string,
  completions: PlannedCompletion[]
): Promise<void> {
  const ids = completions.map((item) => item.id);

  for (let index = 0; index < ids.length; index += UPDATE_CHUNK) {
    const chunk = ids.slice(index, index + UPDATE_CHUNK);
    const { error } = await supabase
      .from("revenue_opportunities")
        .update({
          completed: true,
          close_reason: "scanner_closed",
          updated_at: new Date().toISOString(),
        })
      .eq("practice_id", practiceId)
      .in("id", chunk);

    if (error) {
      throw error;
    }
  }
}

async function insertOpportunities(
  supabase: MergeClient,
  practiceId: string,
  opportunityType: SchedulerOpportunityType,
  inserts: PlannedInsert[]
): Promise<number> {
  let created = 0;

  for (let index = 0; index < inserts.length; index += INSERT_CHUNK) {
    const chunk = inserts.slice(index, index + INSERT_CHUNK);
    const rows = chunk.map((opportunity) => ({
      practice_id: practiceId,
      patient_id: opportunity.patient_id,
      claim_id: opportunity.claim_id,
      procedure_id: opportunity.procedure_id,
      recall_id: opportunity.recall_id,
      opportunity_type: opportunityType,
      priority: opportunity.priority,
      estimated_value: opportunity.estimated_value,
      identified_estimated_value: opportunity.estimated_value,
      identified_at: new Date().toISOString(),
      confidence_score: opportunity.confidence_score ?? null,
      reason: opportunity.reason ?? null,
      recommended_action: opportunity.recommended_action ?? null,
      completed: false,
      close_reason: null,
    }));

    const { data, error } = await supabase
      .from("revenue_opportunities")
      .insert(rows)
      .select("id");

    if (error) {
      throw error;
    }

    created += data?.length ?? rows.length;
  }

  return created;
}

export async function mergeOpportunitiesByType(
  context: Pick<SchedulerPracticeContext, "supabase" | "practiceId">,
  opportunityType: SchedulerOpportunityType,
  candidates: MergeCandidate[]
): Promise<{
  created: number;
  updated: number;
  completed: number;
  droppedUnkeyed: number;
}> {
  if (!context.practiceId?.trim()) {
    throw new Error("Practice id is required.");
  }

  if (!isSchedulerOpportunityType(opportunityType)) {
    throw new Error("Unsupported scheduler opportunity type.");
  }

  const existing = await loadExistingOpportunities(
    context.supabase,
    context.practiceId,
    opportunityType
  );

  const plan = planOpportunityMerge(opportunityType, existing, candidates);

  if (plan.droppedUnkeyed > 0) {
    logger.info("Dropped unkeyed opportunity candidates", {
      practiceId: context.practiceId,
      opportunityType,
      droppedUnkeyed: plan.droppedUnkeyed,
    });
  }

  await updateScannerFields(context.supabase, context.practiceId, plan.updates);
  await completeOpportunities(
    context.supabase,
    context.practiceId,
    plan.completions
  );
  const created = await insertOpportunities(
    context.supabase,
    context.practiceId,
    opportunityType,
    plan.inserts
  );

  return {
    created,
    updated: plan.updates.length,
    completed: plan.completions.length,
    droppedUnkeyed: plan.droppedUnkeyed,
  };
}
