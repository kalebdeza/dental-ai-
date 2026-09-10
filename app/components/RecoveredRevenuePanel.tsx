import {
  RECOVERED_REVENUE_EXPLANATION,
  RECOVERED_REVENUE_TITLE,
  type RecoveredRevenueDetail,
} from "@/lib/data/recoveredRevenue";

type Props = {
  recoveredRevenue: number;
  details: RecoveredRevenueDetail[];
};

function formatDollars(value: number): string {
  return `$${Number(value ?? 0).toLocaleString()}`;
}

export default function RecoveredRevenuePanel({
  recoveredRevenue,
  details,
}: Props) {
  return (
    <section
      style={{
        marginTop: 24,
        padding: 24,
        borderRadius: 16,
        background: "#ecfdf5",
        border: "1px solid #a7f3d0",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "#047857",
        }}
      >
        {RECOVERED_REVENUE_TITLE}
      </h2>
      <p style={{ marginTop: 8, marginBottom: 0, color: "#065f46" }}>
        {RECOVERED_REVENUE_EXPLANATION}
      </p>
      <div
        style={{
          marginTop: 16,
          fontSize: 36,
          fontWeight: 800,
          color: "#064e3b",
        }}
      >
        {formatDollars(recoveredRevenue)}
      </div>

      {details.length === 0 ? (
        <p style={{ marginTop: 12, color: "#047857" }}>
          No attributed insurance payments yet.
        </p>
      ) : (
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#065f46", fontSize: 13 }}>
                <th style={{ padding: "8px 8px 8px 0" }}>Patient</th>
                <th style={{ padding: 8 }}>Claim</th>
                <th style={{ padding: 8 }}>Identified</th>
                <th style={{ padding: 8 }}>Recovered</th>
                <th style={{ padding: 8 }}>Payment posted</th>
                <th style={{ padding: 8 }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {details.map((row) => (
                <tr key={row.attributionId} style={{ color: "#064e3b" }}>
                  <td style={{ padding: "8px 8px 8px 0" }}>{row.patientName}</td>
                  <td style={{ padding: 8 }}>{row.claimNumber ?? "—"}</td>
                  <td style={{ padding: 8 }}>
                    {formatDollars(row.identifiedEstimatedValue)}
                  </td>
                  <td style={{ padding: 8 }}>
                    {formatDollars(row.creditedAmount)}
                  </td>
                  <td style={{ padding: 8 }}>{row.paymentPostedOn}</td>
                  <td style={{ padding: 8 }}>Open Dental ClaimProc</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
