import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

import PatientAI from "./PatientAI";
import RecallEmail from "./RecallEmail";
import InsuranceAppeal from "./InsuranceAppeal";
import PatientHero from "./components/PatientHero";
import RevenueSummary from "./components/RevenueSummary";
import TreatmentCard from "./components/TreatmentCard";
import ClaimsCard from "./components/ClaimsCard";
import RecallCard from "./components/RecallCard";
import PageHeader from "./components/PageHeader";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PatientPage({
  params,
}: PageProps) {
  const { id } = await params;

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (!patient) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Patient not found</h1>
      </main>
    );
  }

  const { data: opportunities, error } = await supabase
    .from("revenue_opportunities")
    .select("*")
    .eq("patient_id", id)
    .eq("completed", false);

  if (error) {
    throw error;
  }

  const treatments = (opportunities ?? []).filter(
    (opportunity) =>
      opportunity.opportunity_type === "Treatment"
  );

  const recalls = (opportunities ?? []).filter(
    (opportunity) =>
      opportunity.opportunity_type === "Recall"
  );

  const claims = (opportunities ?? []).filter(
    (opportunity) =>
      opportunity.opportunity_type === "Claim"
  );

  const treatmentRevenue =
    treatments.reduce(
      (sum, item) =>
        sum + Number(item.estimated_value ?? 0),
      0
    );

  const recallRevenue =
    recalls.reduce(
      (sum, item) =>
        sum + Number(item.estimated_value ?? 0),
      0
    );

  const claimRevenue =
    claims.reduce(
      (sum, item) =>
        sum + Number(item.estimated_value ?? 0),
      0
    );

  const totalRevenue =
    treatmentRevenue +
    recallRevenue +
    claimRevenue;

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-8">
      <PageHeader />

      <PatientHero patient={patient} />

      <RevenueSummary
        totalRevenue={totalRevenue}
        treatmentRevenue={treatmentRevenue}
        claimRevenue={claimRevenue}
        recallRevenue={recallRevenue}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <TreatmentCard
          treatments={treatments}
        />

        <ClaimsCard
          claims={claims}
        />

        <RecallCard
          recalls={recalls}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">
            🤖 AI Recommendation
          </h2>

          <PatientAI
            patient={patient}
            treatments={treatments}
            claims={claims}
            recalls={recalls}
          />
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">
            📞 Recall Email
          </h2>

          <RecallEmail
            patient={patient}
            recalls={recalls}
          />
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">
            📄 Insurance Appeal
          </h2>

          <InsuranceAppeal
            patient={patient}
            claims={claims}
          />
        </div>
      </div>
    </main>
  );
}