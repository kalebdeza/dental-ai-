"use client";

import { useEffect, useState } from "react";

type Opportunity = {
  id: string;
  patient: string;
  opportunity_type: string;
  reason: string | null;
  estimated_value: number;
  priority: string;
  completed: boolean;
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<
    Opportunity[]
  >([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOpportunities() {
      try {
        // Generate fresh opportunities from
        // the current synced Open Dental data.
        await fetch("/api/revenue-scan");

        // Load the saved opportunities.
        const response = await fetch(
          "/api/opportunities"
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load opportunities."
          );
        }

        const data = await response.json();

        setOpportunities(
          Array.isArray(data) ? data : []
        );
      } catch (error) {
        console.error(
          "Failed to load opportunities:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadOpportunities();
  }, []);

  const totalRecovery =
    opportunities.reduce(
      (total, item) =>
        total +
        Number(item.estimated_value ?? 0),
      0
    );

  return (
    <main
      style={{
        padding: "32px",
      }}
    >
      <h1
        style={{
          fontSize: "32px",
          fontWeight: 700,
        }}
      >
        Revenue Opportunities
      </h1>

      <p
        style={{
          marginTop: "8px",
          color: "#64748b",
        }}
      >
        AI has identified revenue opportunities
        based on the practice's current data.
      </p>

      <div
        style={{
          background: "#ffffff",
          padding: "20px",
          borderRadius: "12px",
          marginTop: "20px",
          marginBottom: "30px",
          boxShadow:
            "0 2px 10px rgba(0,0,0,.08)",
        }}
      >
        <h2>Total Recoverable Revenue</h2>

        <h1
          style={{
            color: "#16a34a",
            fontSize: "32px",
            fontWeight: 700,
          }}
        >
          ${totalRecovery.toLocaleString()}
        </h1>
      </div>

      {loading ? (
        <p>Loading opportunities...</p>
      ) : opportunities.length === 0 ? (
        <div
          style={{
            background: "white",
            padding: "24px",
            borderRadius: "12px",
            boxShadow:
              "0 2px 10px rgba(0,0,0,.08)",
          }}
        >
          <p>
            No open revenue opportunities found.
          </p>
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "white",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow:
              "0 2px 10px rgba(0,0,0,.08)",
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
                  padding: "16px",
                  textAlign: "left",
                }}
              >
                Patient
              </th>

              <th
                style={{
                  padding: "16px",
                  textAlign: "left",
                }}
              >
                Type
              </th>

              <th
                style={{
                  padding: "16px",
                  textAlign: "left",
                }}
              >
                Opportunity
              </th>

              <th
                style={{
                  padding: "16px",
                  textAlign: "left",
                }}
              >
                Estimated Value
              </th>

              <th
                style={{
                  padding: "16px",
                  textAlign: "left",
                }}
              >
                Priority
              </th>
            </tr>
          </thead>

          <tbody>
            {opportunities.map((item) => (
              <tr key={item.id}>
                <td
                  style={{
                    padding: "16px",
                    borderBottom:
                      "1px solid #eee",
                    fontWeight: 600,
                  }}
                >
                  {item.patient}
                </td>

                <td
                  style={{
                    padding: "16px",
                    borderBottom:
                      "1px solid #eee",
                  }}
                >
                  {item.opportunity_type}
                </td>

                <td
                  style={{
                    padding: "16px",
                    borderBottom:
                      "1px solid #eee",
                  }}
                >
                  {item.reason ??
                    "Revenue opportunity"}
                </td>

                <td
                  style={{
                    padding: "16px",
                    borderBottom:
                      "1px solid #eee",
                    color: "#16a34a",
                    fontWeight: 700,
                  }}
                >
                  $
                  {Number(
                    item.estimated_value ?? 0
                  ).toLocaleString()}
                </td>

                <td
                  style={{
                    padding: "16px",
                    borderBottom:
                      "1px solid #eee",
                  }}
                >
                  <span
                    style={{
                      background:
                        item.priority === "High"
                          ? "#fee2e2"
                          : item.priority ===
                              "Medium"
                            ? "#fef3c7"
                            : "#dcfce7",
                      color:
                        item.priority === "High"
                          ? "#b91c1c"
                          : item.priority ===
                              "Medium"
                            ? "#92400e"
                            : "#15803d",
                      padding: "6px 12px",
                      borderRadius: "999px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    {item.priority}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}