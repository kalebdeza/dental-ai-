import { getPatients } from "./patients";
import { getClaims } from "./claims";
import { getRevenueOpportunities } from "./revenue";

export async function getDashboardData() {
  const [patients, claims, opportunities] =
    await Promise.all([
      getPatients(),
      getClaims(),
      getRevenueOpportunities(),
    ]);

  return {
    patients,
    claims,
    opportunities,
  };
}