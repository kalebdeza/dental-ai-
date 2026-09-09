import { buildRecallOpportunities } from "@/lib/opendental/recallOpportunities";
import type { SupabaseServerClient } from "@/lib/auth/types";

export class RecallScannerService {
  async scan(
    supabase: SupabaseServerClient,
    practiceId: string
  ) {
    const { data: recalls, error } = await supabase
      .from("recalls")
      .select(
        "id, patient_id, due_date, completed_date, recall_type, estimated_revenue"
      )
      .eq("practice_id", practiceId);

    if (error) {
      throw error;
    }

    return buildRecallOpportunities(recalls ?? []).map((opportunity) => ({
      patient_id: opportunity.patient_id,
      recall_id: opportunity.recall_id,
      opportunity_type: "Recall" as const,
      priority: opportunity.priority,
      estimated_value: opportunity.estimated_value,
      confidence_score: opportunity.confidence_score,
      reason: opportunity.reason,
      recommended_action: opportunity.recommended_action,
    }));
  }
}

export const recallScanner = new RecallScannerService();
