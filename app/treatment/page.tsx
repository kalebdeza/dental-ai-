"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TreatmentOpportunity = {
  id: string;
  patient: string;
  opportunity_type: string;
  reason: string | null;
  estimated_value: number;
  priority: string;
  recommendedAction: string | null;
  completed: boolean;
};

export default function TreatmentPage() {
  const [
    opportunities,
    setOpportunities,
  ] = useState<TreatmentOpportunity[]>(
    []
  );

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Refresh opportunities using the
        // current synced practice data.
        await fetch("/api/revenue-scan");

        const res = await fetch(
          "/api/treatment"
        );

        if (!res.ok) {
          throw new Error(
            "Failed to load treatment opportunities."
          );
        }

        const data = await res.json();

        setOpportunities(
          Array.isArray(data) ? data : []
        );
      } catch (error) {
        console.error(
          "Failed to load treatments:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const totalRevenue =
    opportunities.reduce(
      (sum, item) =>
        sum +
        Number(
          item.estimated_value ?? 0
        ),
      0
    );

  const highPriority =
    opportunities.filter(
      (item) =>
        item.priority === "High"
    ).length;

  if (loading) {
    return (
      <main style={{ padding: 30 }}>
        <h2>
          Loading Treatment Opportunities...
        </h2>
      </main>
    );
  }

  return (
    <main style={{ padding: 30 }}>
      <h1>
        🦷 Treatment Recovery
      </h1>

      <p
        style={{
          color: "#64748b",
          marginTop: 8,
          marginBottom: 30,
        }}
      >
        Treatment opportunities are based on
        verified practice data.
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
            padding: 20,
            borderRadius: 12,
            boxShadow:
              "0 2px 8px rgba(0,0,0,.08)",
          }}
        >
          <h3>
            Estimated Production
          </h3>

          <h2>
            $
            {totalRevenue.toLocaleString()}
          </h2>
        </div>

        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 12,
            boxShadow:
              "0 2px 8px rgba(0,0,0,.08)",
          }}
        >
          <h3>Patients</h3>

          <h2>
            {opportunities.length}
          </h2>
        </div>

        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 12,
            boxShadow:
              "0 2px 8px rgba(0,0,0,.08)",
          }}
        >
          <h3>High Priority</h3>

          <h2>{highPriority}</h2>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div
          style={{
            background: "white",
            padding: 24,
            borderRadius: 12,
            boxShadow:
              "0 2px 8px rgba(0,0,0,.08)",
          }}
        >
          <p>
            No verified treatment opportunities
            found.
          </p>
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "white",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f8fafc",
              }}
            >
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
                Estimated Value
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
            {opportunities.map(
              (item) => (
                <tr key={item.id}>
                  <td
                    style={{
                      padding: 16,
                    }}
                  >
                    {item.patient}
                  </td>

                  <td
                    style={{
                      padding: 16,
                    }}
                  >
                    {item.reason ??
                      "Treatment opportunity"}
                  </td>

                  <td
                    style={{
                      padding: 16,
                    }}
                  >
                    $
                    {Number(
                      item.estimated_value ??
                        0
                    ).toLocaleString()}
                  </td>

                  <td
                    style={{
                      padding: 16,
                    }}
                  >
                    {item.priority}
                  </td>

                  <td
                    style={{
                      padding: 16,
                    }}
                  >
                    <Link
                      href={`/treatment/${item.id}`}
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </main>
  );
}