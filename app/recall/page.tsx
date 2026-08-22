"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Recall = {
  id: string;
  patient: string;
  reason: string | null;
  estimated_value: number;
  priority: string;
  completed: boolean;
};

export default function RecallPage() {
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Refresh revenue opportunities from
        // the current synced Open Dental data.
        await fetch("/api/revenue-scan");

        // Load recall opportunities.
        const res = await fetch("/api/recall");
        const data = await res.json();

        setRecalls(
          Array.isArray(data) ? data : []
        );
      } catch (err) {
        console.error(
          "Failed to load recalls:",
          err
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <h2>Loading Recall Dashboard...</h2>;
  }

  const totalRevenue = recalls.reduce(
    (sum, recall) =>
      sum +
      Number(recall.estimated_value ?? 0),
    0
  );

  const highPriority = recalls.filter(
    (recall) => recall.priority === "High"
  ).length;

  return (
    <main>
      <h1
        style={{
          fontSize: "36px",
          marginBottom: 8,
        }}
      >
        📞 Recall Revenue Recovery
      </h1>

      <p
        style={{
          color: "#64748b",
          fontSize: "18px",
          marginBottom: 30,
        }}
      >
        AI is identifying overdue patients and
        estimating recoverable production.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 20,
          marginBottom: 30,
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow:
              "0 2px 10px rgba(0,0,0,.08)",
          }}
        >
          <h3>💰 Recoverable Revenue</h3>

          <h1>
            ${totalRevenue.toLocaleString()}
          </h1>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow:
              "0 2px 10px rgba(0,0,0,.08)",
          }}
        >
          <h3>👥 Recall Patients</h3>

          <h1>{recalls.length}</h1>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow:
              "0 2px 10px rgba(0,0,0,.08)",
          }}
        >
          <h3>🔥 High Priority</h3>

          <h1>{highPriority}</h1>
        </div>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow:
            "0 2px 10px rgba(0,0,0,.08)",
        }}
      >
        {recalls.length === 0 ? (
          <div style={{ padding: 24 }}>
            <p>
              No open recall opportunities found.
            </p>
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead
              style={{
                background: "#2563eb",
                color: "white",
              }}
            >
              <tr>
                <th
                  style={{
                    padding: 16,
                    textAlign: "left",
                  }}
                >
                  Patient
                </th>

                <th
                  style={{
                    padding: 16,
                    textAlign: "left",
                  }}
                >
                  Opportunity
                </th>

                <th
                  style={{
                    padding: 16,
                    textAlign: "left",
                  }}
                >
                  Revenue
                </th>

                <th
                  style={{
                    padding: 16,
                    textAlign: "left",
                  }}
                >
                  Priority
                </th>

                <th
                  style={{
                    padding: 16,
                    textAlign: "left",
                  }}
                >
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {recalls.map((recall) => (
                <tr
                  key={recall.id}
                  style={{
                    borderBottom:
                      "1px solid #e2e8f0",
                  }}
                >
                  <td style={{ padding: 16 }}>
                    {recall.patient}
                  </td>

                  <td style={{ padding: 16 }}>
                    {recall.reason ??
                      "Overdue recall"}
                  </td>

                  <td style={{ padding: 16 }}>
                    $
                    {Number(
                      recall.estimated_value ?? 0
                    ).toLocaleString()}
                  </td>

                  <td style={{ padding: 16 }}>
                    {recall.priority === "High"
                      ? "🔴 High"
                      : recall.priority ===
                          "Medium"
                        ? "🟡 Medium"
                        : "🟢 Low"}
                  </td>

                  <td style={{ padding: 16 }}>
                    <Link
                      href={`/recall/${recall.id}`}
                    >
                      <button
                        style={{
                          background: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          padding:
                            "10px 16px",
                          cursor: "pointer",
                        }}
                      >
                        Review →
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}