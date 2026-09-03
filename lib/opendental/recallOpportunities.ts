import { isRecallComplete } from "./status.ts";

export type RecallOpportunityRow = {
  patient_id: string;
  due_date: string | null;
  completed_date: string | null;
  recall_type: string | null;
  estimated_revenue: number | null;
};

export type RecallOpportunity = {
  patient_id: string;
  priority: string;
  estimated_value: number;
  confidence_score: number;
  reason: string;
  recommended_action: string;
};

export function buildRecallOpportunities(
  recalls: RecallOpportunityRow[],
  now = new Date()
): RecallOpportunity[] {
  const opportunities: RecallOpportunity[] = [];
  const today = now;

  for (const recall of recalls) {
    if (!recall.due_date) {
      continue;
    }

    if (isRecallComplete(recall.completed_date)) {
      continue;
    }

    const dueDate = new Date(recall.due_date);

    if (dueDate >= today) {
      continue;
    }

    const daysOverdue = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let priority = "Low";

    if (daysOverdue >= 180) {
      priority = "High";
    } else if (daysOverdue >= 90) {
      priority = "Medium";
    }

    const estimatedValue = Number(recall.estimated_revenue ?? 0);

    if (estimatedValue <= 0) {
      continue;
    }

    opportunities.push({
      patient_id: recall.patient_id,
      priority,
      estimated_value: estimatedValue,
      confidence_score: 95,
      reason: `Patient is ${daysOverdue} days overdue for ${
        recall.recall_type ?? "dental recall"
      }.`,
      recommended_action:
        "Contact the patient and schedule the overdue recall appointment.",
    });
  }

  return opportunities;
}
