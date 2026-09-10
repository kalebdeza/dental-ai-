"use client";

import { useEffect, useState } from "react";
import WorkQueueBoard from "../components/WorkQueueBoard";
import type { RecallOpportunityApiItem } from "@/lib/data/recallWorkflow";
import { toWorkQueueItem, type WorkQueueItem } from "@/lib/data/workQueue";

function fromRecall(row: RecallOpportunityApiItem): WorkQueueItem {
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
    dueDate: row.dueDate,
    completed: row.completed,
  });
}

export default function RecallPage() {
  const [items, setItems] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/recall");
        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];
        setItems(rows.map(fromRecall));
      } catch {
        console.error("Failed to load recalls.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <h2>Loading Recall Dashboard...</h2>;
  }

  return (
    <main>
      <h1
        style={{
          fontSize: "36px",
          marginBottom: 8,
        }}
      >
        📞 Recall work queue
      </h1>

      <p
        style={{
          color: "#64748b",
          fontSize: "18px",
          marginBottom: 30,
        }}
      >
        Today shows open and contacted recalls that are not snoozed.
        Estimated values are not recovered revenue.
      </p>

      <WorkQueueBoard
        items={items}
        hrefFor={(item) => `/recall/${item.id}`}
      />
    </main>
  );
}
