import { revenueScanner } from "@/services/revenueScanner";
import { recallScanner } from "@/services/recallScanner";
import { treatmentScanner } from "@/services/treatmentScanner";
import { opportunityService } from "@/services/opportunityService";

export class RevenueOpportunityScanner {
  async scan(practiceId: string) {
    const [
      claimOpportunities,
      recallOpportunities,
      treatmentOpportunities,
    ] = await Promise.all([
      revenueScanner.scan(practiceId),
      recallScanner.scan(practiceId),
      treatmentScanner.scan(practiceId),
    ]);

    const opportunities = [
      ...claimOpportunities,
      ...recallOpportunities,
      ...treatmentOpportunities,
    ];

    const result =
      await opportunityService.replaceOpenOpportunities(
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