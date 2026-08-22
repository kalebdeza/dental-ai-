import { supabase } from "@/lib/supabase";

export class RecallScannerService {
  async scan(practiceId: string) {
    const { data: recalls, error } =
      await supabase
        .from("recalls")
        .select("*")
        .eq("practice_id", practiceId);

    if (error) {
      throw error;
    }

    const opportunities = [];
    const today = new Date();

    for (const recall of recalls ?? []) {
      if (!recall.due_date) {
        continue;
      }

      if (
        recall.status === "Completed" ||
        recall.completed_date
      ) {
        continue;
      }

      const dueDate = new Date(
        recall.due_date
      );

      if (dueDate >= today) {
        continue;
      }

      const daysOverdue = Math.floor(
        (today.getTime() -
          dueDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      let priority = "Low";

      if (daysOverdue >= 180) {
        priority = "High";
      } else if (daysOverdue >= 90) {
        priority = "Medium";
      }

      const estimatedValue = Number(
        recall.estimated_revenue ?? 0
      );

      if (estimatedValue <= 0) {
        continue;
      }

      opportunities.push({
        practice_id: practiceId,
        patient_id: recall.patient_id,
        opportunity_type: "Recall",
        priority,
        estimated_value: estimatedValue,
        confidence_score: 95,
        reason: `Patient is ${daysOverdue} days overdue for ${
          recall.recall_type ??
          "dental recall"
        }.`,
        recommended_action:
          "Contact the patient and schedule the overdue recall appointment.",
        completed: false,
      });
    }

    return opportunities;
  }
}

export const recallScanner =
  new RecallScannerService();