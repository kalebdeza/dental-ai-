import type { OpportunityFunnelMetrics } from "@/lib/data/opportunityFunnel";

type Props = {
  funnel: OpportunityFunnelMetrics;
};

function formatEstimated(value: number): string {
  return `$${value.toLocaleString()}`;
}

function StageCard({
  title,
  count,
  patientCount,
  estimatedValue,
}: {
  title: string;
  count: number;
  patientCount: number;
  estimatedValue: number;
}) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 16,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "#475569",
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 32,
          fontWeight: 800,
          color: "#0f172a",
        }}
      >
        {count}
      </div>
      <div style={{ marginTop: 4, color: "#64748b", fontSize: 14 }}>
        {patientCount} patients · {count} opportunities
      </div>
      <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700 }}>
        {formatEstimated(estimatedValue)}{" "}
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
          Estimated
        </span>
      </div>
    </div>
  );
}

export default function RevenueRecoveryFunnel({ funnel }: Props) {
  return (
    <section
      style={{
        marginTop: 32,
        background: "#ffffff",
        borderRadius: 24,
        padding: 32,
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 30px rgba(15,23,42,.08)",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: 8,
          fontSize: 28,
        }}
      >
        Revenue Recovery Funnel
      </h2>
      <p style={{ marginTop: 0, marginBottom: 24, color: "#64748b" }}>
        Estimated opportunity value — not recovered revenue.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 16,
        }}
      >
        <StageCard
          title="Identified"
          count={funnel.identified.count}
          patientCount={funnel.identified.patientCount}
          estimatedValue={funnel.identified.estimatedValue}
        />
        <StageCard
          title="Contacted"
          count={funnel.contacted.count}
          patientCount={funnel.contacted.patientCount}
          estimatedValue={funnel.contacted.estimatedValue}
        />
        <StageCard
          title="Scheduled"
          count={funnel.scheduled.count}
          patientCount={funnel.scheduled.patientCount}
          estimatedValue={funnel.scheduled.estimatedValue}
        />
        <StageCard
          title="Completed"
          count={funnel.officeCompleted.count}
          patientCount={funnel.officeCompleted.patientCount}
          estimatedValue={funnel.officeCompleted.estimatedValue}
        />
      </div>

      <div
        style={{
          marginTop: 20,
          color: "#475569",
          fontSize: 14,
        }}
      >
        Scanner closed: {funnel.scannerClosedCount} opportunities (no longer in
        the scan — not recovered revenue). Office dismissed:{" "}
        {funnel.officeDismissedCount}. Open pipeline: {funnel.openPipeline.count}{" "}
        opportunities, {formatEstimated(funnel.openPipeline.estimatedValue)}{" "}
        Estimated.
      </div>
    </section>
  );
}
