import { supabase } from "@/lib/supabase";

type Opportunity = {
  practice_id: string;
  patient_id?: string | null;
  claim_id?: string | null;
  procedure_id?: string | null;
  opportunity_type: string;
  priority: string;
  estimated_value: number;
  confidence_score?: number | null;
  reason?: string | null;
  recommended_action?: string | null;
  completed: boolean;
};

export class OpportunityService {
  async replaceOpenOpportunities(
    practiceId: string,
    opportunities: Opportunity[]
  ) {
    // Remove existing incomplete opportunities for this practice.
    //
    // We regenerate these from the current Open Dental data,
    // so this prevents stale opportunities from accumulating.
    const { error: deleteError } = await supabase
      .from("revenue_opportunities")
      .delete()
      .eq("practice_id", practiceId)
      .eq("completed", false);

    if (deleteError) {
      throw deleteError;
    }

    if (opportunities.length === 0) {
      return {
        created: 0,
      };
    }

    const { data, error } = await supabase
      .from("revenue_opportunities")
      .insert(opportunities)
      .select("id");

    if (error) {
      throw error;
    }

    return {
      created: data?.length ?? 0,
    };
  }
}

export const opportunityService =
  new OpportunityService();