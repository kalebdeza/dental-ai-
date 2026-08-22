import { useEffect, useState } from "react";

type AIInsightsProps = {
  totalRecoverableRevenue: number;
  claimsRevenue: number;
  recallRevenue: number;
  treatmentRevenue: number;
  claimOpportunities: number;
  recallPatients: number;
  treatmentPatients: number;
};

export default function AIInsights({
  totalRecoverableRevenue,
  claimsRevenue,
  recallRevenue,
  treatmentRevenue,
  claimOpportunities,
  recallPatients,
  treatmentPatients,
}: AIInsightsProps) {
  const opportunities = [
    {
      title: "Treatment Recovery",
      revenue: treatmentRevenue,
      message: `Schedule ${treatmentPatients} treatment patient${
        treatmentPatients === 1 ? "" : "s"
      } to recover $${treatmentRevenue.toLocaleString()}.`,
      color: "#dc2626",
    },
    {
      title: "Claims Recovery",
      revenue: claimsRevenue,
      message: `Review ${claimOpportunities} insurance claim${
        claimOpportunities === 1 ? "" : "s"
      } worth $${claimsRevenue.toLocaleString()}.`,
      color: "#2563eb",
    },
    {
      title: "Recall Recovery",
      revenue: recallRevenue,
      message: `Contact ${recallPatients} overdue recall patient${
        recallPatients === 1 ? "" : "s"
      } representing $${recallRevenue.toLocaleString()}.`,
      color: "#9333ea",
    },
  ].sort((a, b) => b.revenue - a.revenue);

  const highest = opportunities[0];

  const confidence =
    totalRecoverableRevenue === 0
      ? 70
      : Math.min(
          98,
          70 + Math.round((highest.revenue / totalRecoverableRevenue) * 30)
        );

  const insight =
    highest.title === "Treatment Recovery"
      ? "Treatment plans represent the largest recoverable opportunity. Prioritizing these patients could recover the greatest amount of revenue with the fewest calls."
      : highest.title === "Claims Recovery"
      ? "Insurance claims currently represent the largest recoverable revenue source. Following up on outstanding claims should produce the quickest return."
      : "Recall patients currently represent your largest opportunity. Re-engaging overdue patients is likely to increase both hygiene production and future treatment acceptance.";

  const projectedRecovery = Math.round(highest.revenue * 0.65);
const [aiSummary, setAiSummary] = useState("Generating AI analysis...");

useEffect(() => {
  async function loadAI() {
    try {
      const response = await fetch("/api/ai-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          totalRecoverableRevenue,
          claimsRevenue,
          recallRevenue,
          treatmentRevenue,
          claimOpportunities,
          recallPatients,
          treatmentPatients,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setAiSummary(result.insight);
      }
    } catch (error) {
      console.error(error);
      setAiSummary("Unable to generate AI analysis.");
    }
  }

  loadAI();
}, [
  totalRecoverableRevenue,
  claimsRevenue,
  recallRevenue,
  treatmentRevenue,
  claimOpportunities,
  recallPatients,
  treatmentPatients,
]);
  return (
    <div
      style={{
        marginTop: 32,
        background: "#fff",
        borderRadius: 24,
        padding: 32,
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 30px rgba(15,23,42,.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 12,
              letterSpacing: ".1em",
              color: "#64748b",
            }}
          >
            AI Analysis
          </div>

          <h2 style={{ margin: "8px 0 0" }}>
            AI Insights
          </h2>
        </div>

        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "8px 16px",
            borderRadius: 999,
            fontWeight: 700,
          }}
        >
          Live
        </div>
      </div>

      <div
        style={{
          background: "#f8fafc",
          padding: 20,
          borderRadius: 18,
          marginBottom: 24,
        }}
      >
        <strong>Highest Priority</strong>

        <div
          style={{
            marginTop: 10,
            fontSize: 18,
            fontWeight: 700,
            color: highest.color,
          }}
        >
          {highest.title}
        </div>

        <p
          style={{
            marginBottom: 0,
            color: "#475569",
            lineHeight: 1.7,
          }}
        >
          {highest.message}
        </p>
      </div>

      <h3>AI Recommendation</h3>

      <div
        style={{
          background: "#eff6ff",
          padding: 20,
          borderRadius: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          💡 AI Analysis
        </div>

<p
  style={{
    lineHeight: 1.7,
    color: "#334155",
    marginTop: 0,
    whiteSpace: "pre-line",
  }}
>
  {aiSummary}
</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 20,
            marginTop: 20,
          }}
        >
          <div>
            <strong>Projected Recovery</strong>

            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#16a34a",
              }}
            >
              ${projectedRecovery.toLocaleString()}
            </div>
          </div>

          <div>
            <strong>AI Confidence</strong>

            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#2563eb",
              }}
            >
              {confidence}%
            </div>
          </div>
        </div>
      </div>

      <h3>Recommended Actions</h3>

      <ol
        style={{
          lineHeight: 2,
          paddingLeft: 20,
        }}
      >
        {opportunities.map((item) => (
          <li key={item.title}>
            {item.message}
          </li>
        ))}
      </ol>

      <div
        style={{
          marginTop: 24,
          padding: 18,
          borderRadius: 16,
          background: "#eff6ff",
        }}
      >
        <strong>Total Revenue Opportunity</strong>

        <div
          style={{
            fontSize: 34,
            fontWeight: 800,
            marginTop: 10,
            color: "#2563eb",
          }}
        >
          ${totalRecoverableRevenue.toLocaleString()}
        </div>
      </div>
    </div>
  );
}