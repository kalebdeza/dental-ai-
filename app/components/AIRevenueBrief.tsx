type AIRevenueBriefProps = {
  totalRecoverableRevenue: number;
  claimsRevenue: number;
  recallRevenue: number;
  treatmentRevenue: number;
};

export default function AIRevenueBrief({
  totalRecoverableRevenue,
  claimsRevenue,
  recallRevenue,
  treatmentRevenue,
}: AIRevenueBriefProps) {
  const opportunities = [
    { name: "Treatment Recovery", revenue: treatmentRevenue },
    { name: "Claims Recovery", revenue: claimsRevenue },
    { name: "Recall Recovery", revenue: recallRevenue },
  ].sort((a, b) => b.revenue - a.revenue);

  const highest = opportunities[0];

  const projectedRecovery = Math.round(
    totalRecoverableRevenue * 0.65
  );

  return (
    <div
      style={{
        marginTop: 32,
        marginBottom: 32,
        padding: 32,
        borderRadius: 24,
        background:
          "linear-gradient(135deg,#ecfeff,#eff6ff)",
        border: "1px solid #bfdbfe",
        boxShadow: "0 10px 30px rgba(15,23,42,.08)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          color: "#2563eb",
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        AI Daily Brief
      </div>

      <h2
        style={{
          marginTop: 0,
          marginBottom: 24,
          fontSize: 30,
        }}
      >
        Good Morning 👋
      </h2>

      <p
        style={{
          fontSize: 18,
          lineHeight: 1.8,
          color: "#334155",
        }}
      >
        Your practice currently has{" "}
        <strong>
          ${totalRecoverableRevenue.toLocaleString()}
        </strong>{" "}
        in recoverable revenue.

        The largest opportunity today is{" "}
        <strong>{highest.name}</strong>, representing{" "}
        <strong>
          ${highest.revenue.toLocaleString()}
        </strong>.

        If your team focuses on the highest-value opportunities first,
        today's estimated recoverable revenue is approximately{" "}
        <strong>
          ${projectedRecovery.toLocaleString()}
        </strong>.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",
          gap: 20,
          marginTop: 30,
        }}
      >
        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
            }}
          >
            Highest Priority
          </div>

          <div
            style={{
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            {highest.name}
          </div>
        </div>

        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
            }}
          >
            Revenue Opportunity
          </div>

          <div
            style={{
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            ${highest.revenue.toLocaleString()}
          </div>
        </div>

        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
            }}
          >
            Estimated Recovery Today
          </div>

          <div
            style={{
              fontWeight: 800,
              fontSize: 22,
              color: "#16a34a",
            }}
          >
            ${projectedRecovery.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}