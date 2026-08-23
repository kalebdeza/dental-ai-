import { revenueScanner } from "@/services/revenueScanner";
import { recallScanner } from "@/services/recallScanner";
import { treatmentScanner } from "@/services/treatmentScanner";
import { opportunityService } from "@/services/opportunityService";

import type { SupabaseServerClient } from "@/lib/auth/types";

export class RevenueOpportunityScanner {
  async scan(
    supabase: SupabaseServerClient,
    practiceId: string
  ) {
    const [
      claimOpportunities,
      recallOpportunities,
      treatmentOpportunities,
    ] = await Promise.all([
      revenueScanner.scan(supabase, practiceId),
      recallScanner.scan(supabase, practiceId),
      treatmentScanner.scan(supabase, practiceId),
    ]);

    const opportunities = [
      ...claimOpportunities,
      ...recallOpportunities,
      ...treatmentOpportunities,
    ];

    const result =
      await opportunityService.replaceOpenOpportunities(
        supabase,
        practiceId,
        opportunities
      );

    return {
      ...result,
      claims: claimOpportunities.length,
      recalls: recallOpportunities.length,
      treatments: treatmentOpportunities.length,
    };
  }
}

export const revenueOpportunityScanner =
  new RevenueOpportunityScanner();