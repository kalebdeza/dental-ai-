"use client";

import { useEffect, useState } from "react";
import WorkQueueBoard from "../components/WorkQueueBoard";
import type { TreatmentOpportunityApiItem } from "@/lib/data/treatmentWorkflow";
import { toWorkQueueItem, type WorkQueueItem } from "@/lib/data/workQueue";

function fromTreatment(row: TreatmentOpportunityApiItem): WorkQueueItem {
  return toWorkQueueItem({
    id: row.id,
    patient: row.patient,
    patientId: row.patientId,
    opportunityType: row.opportunity_type,
    reason: row.reason,
    estimatedValue: row.estimated_value,
    priority: row.priority,
    workflowStatus: row.workflowStatus,
    contactOutcome: row.contactOutcome,
    snoozedUntil: row.snoozedUntil,
    identifiedAt: row.identifiedAt,
    lastActedAt: row.lastActedAt,
    completed: row.completed,
  });
}

export default function TreatmentPage() {
  const [items, setItems] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/treatment");

        if (!res.ok) {
          throw new Error("Failed to load treatment opportunities.");
        }

        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];
        setItems(rows.map(fromTreatment));
      } catch {
        console.error("Failed to load treatments.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 30 }}>
        <h2>Loading Treatment Opportunities...</h2>
      </main>
    );
  }

  return (
    <main style={{ padding: 30 }}>
      <h1>🦷 Treatment work queue</h1>

      <p
        style={{
          color: "#64748b",
          marginTop: 8,
          marginBottom: 30,
        }}
      >
        Today shows open and contacted treatment opportunities that are not
        snoozed. Estimated values are not recovered revenue.
      </p>

      <WorkQueueBoard
        items={items}
        hrefFor={(item) => `/treatment/${item.id}`}
      />
    </main>
  );
}
