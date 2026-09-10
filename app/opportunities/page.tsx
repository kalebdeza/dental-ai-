"use client";

import { useEffect, useState } from "react";
import WorkQueueBoard from "../components/WorkQueueBoard";
import { toWorkQueueItem, type WorkQueueItem } from "@/lib/data/workQueue";

export default function OpportunitiesPage() {
  const [items, setItems] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOpportunities() {
      try {
        const response = await fetch("/api/opportunities");

        if (!response.ok) {
          throw new Error("Failed to load opportunities.");
        }

        const data = await response.json();
        const rows = Array.isArray(data) ? data : [];
        setItems(rows.map((row: WorkQueueItem) => toWorkQueueItem(row)));
      } catch {
        console.error("Failed to load opportunities.");
      } finally {
        setLoading(false);
      }
    }

    loadOpportunities();
  }, []);

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
          marginBottom: 24,
        }}
      >
        Today shows open and contacted opportunities that are not snoozed.
        Estimated values are not recovered revenue.
      </p>

      {loading ? (
        <p>Loading opportunities...</p>
      ) : (
        <WorkQueueBoard
          items={items}
          showType
          enableTypeFilter
          hrefFor={(item) => `/opportunities/${item.id}`}
        />
      )}
    </main>
  );
}
