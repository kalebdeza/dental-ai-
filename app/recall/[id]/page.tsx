"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OpportunityCard from "@/app/components/OpportunityCard";
import OpportunityActivityTimeline from "@/app/components/OpportunityActivityTimeline";
import RecallActions from "./RecallActions";
import RecallWorkflowStatus from "./RecallWorkflowStatus";
import {
  postOfficeWorkflow,
  officeWorkflowSuccessMessage,
  toSnoozeIso,
} from "@/app/components/postOfficeWorkflow";
import type { OfficeActionId } from "@/app/components/OfficeWorkflowActions";
import {
  formatRecallDueDate,
  formatStoredText,
  getPersistedRecallStatus,
  getRecallWorkflowActions,
  SCHEDULE_IN_PMS_GUIDANCE,
  storedRecallRecommendation,
  toTelHref,
  type RecallOpportunityApiItem,
} from "@/lib/data/recallWorkflow";
import type { OpportunityActivityRow } from "@/lib/data/opportunityWorkflow";

export default function RecallDetail() {
  const params = useParams();
  const router = useRouter();

  const [recall, setRecall] =
    useState<RecallOpportunityApiItem | null>(null);
  const [activities, setActivities] = useState<OpportunityActivityRow[]>([]);
  const [loadState, setLoadState] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [snoozeUntil, setSnoozeUntil] = useState("");

  async function load() {
    const res = await fetch(`/api/recall?id=${String(params.id)}`);

    if (!res.ok) {
      if (res.status === 404) {
        setRecall(null);
        setActivities([]);
        setLoadState("missing");
        return;
      }
      throw new Error("Failed to load recall opportunities.");
    }

    const data = await res.json();
    setRecall(data.item ?? null);
    setActivities(Array.isArray(data.activities) ? data.activities : []);
    setLoadState(data.item ? "ready" : "missing");
  }

  useEffect(() => {
    async function run() {
      try {
        await load();
      } catch {
        console.error("Failed to load recall.");
        setRecall(null);
        setLoadState("error");
      }
    }

    void run();
  }, [params.id]);

  async function runWorkflow(
    action: string,
    extra: { contactOutcome?: string; snoozedUntil?: string } = {}
  ) {
    if (!recall) {
      return;
    }

    try {
      setBusyAction(
        extra.contactOutcome ? `outcome:${extra.contactOutcome}` : action
      );
      setNotice(null);

      await postOfficeWorkflow({
        opportunityId: recall.id,
        action,
        note: note.trim() || undefined,
        ...extra,
      });

      setNote("");
      setSnoozeUntil("");
      if (action === "dismiss" || action === "complete") {
        router.push("/recall");
        return;
      }

      await load();
      setNotice(officeWorkflowSuccessMessage(action, extra));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not save this workflow action."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAction(id: OfficeActionId) {
    if (id === "call") {
      return;
    }

    if (id === "schedule") {
      setNotice(SCHEDULE_IN_PMS_GUIDANCE);
      return;
    }

    if (id === "add_note" && !note.trim()) {
      setNotice("Enter a note before saving.");
      return;
    }

    if (id === "snooze") {
      const snoozedUntil = toSnoozeIso(snoozeUntil);
      if (!snoozedUntil) {
        setNotice("Choose a future snooze time.");
        return;
      }
      await runWorkflow("snooze", { snoozedUntil });
      return;
    }

    if (id === "dismiss") {
      const confirmed = window.confirm(
        "Dismiss this recall from the work queue? It stays in the database and will not come back on the next scan."
      );
      if (!confirmed) {
        return;
      }
    }

    const action =
      id === "mark_contacted"
        ? "mark_contacted"
        : id === "add_note"
          ? "add_note"
          : id === "complete"
            ? "complete"
            : "dismiss";

    await runWorkflow(action);
  }

  if (loadState === "loading") {
    return (
      <main style={{ padding: 30 }}>
        <h2>Loading...</h2>
      </main>
    );
  }

  if (loadState !== "ready" || !recall) {
    return (
      <main style={{ padding: 30 }}>
        <button
          onClick={() => router.back()}
          style={{
            marginBottom: 24,
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <h2>
          {loadState === "error"
            ? "Could not load this recall opportunity."
            : "Recall opportunity not found."}
        </h2>
      </main>
    );
  }

  const revenue = Number(recall.estimated_value ?? 0);
  const status = getPersistedRecallStatus({
    workflow_status: recall.workflowStatus,
    completed: recall.completed,
  });
  const recommendation = storedRecallRecommendation(
    recall.recommendedAction,
    recall.reason
  );
  const actions = getRecallWorkflowActions({
    phone: recall.phone,
    workflowStatus: recall.workflowStatus,
    completed: recall.completed,
  });
  const telHref = toTelHref(recall.phone);

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 30,
      }}
    >
      <button
        onClick={() => router.back()}
        style={{
          marginBottom: 16,
          padding: "10px 18px",
          borderRadius: 8,
          border: "none",
          background: "#2563eb",
          color: "white",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      <p
        style={{
          marginTop: 0,
          marginBottom: 8,
          color: "#64748b",
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          fontSize: 13,
        }}
      >
        Recall Action Center
      </p>

      <RecallWorkflowStatus
        workflowStatus={recall.workflowStatus}
        completed={recall.completed}
        contactOutcome={recall.contactOutcome}
        snoozedUntil={recall.snoozedUntil}
      />

      <OpportunityCard
        title="Recall Opportunity"
        patient={recall.patient}
        type={recall.opportunity_type}
        status={status}
        priority={recall.priority}
        revenue={revenue}
        recommendation={recommendation.text}
        primaryAction="Call Patient"
        showFooterActions={false}
        details={
          <>
            <p>
              <strong>Patient:</strong> {recall.patient}
            </p>

            <p>
              <strong>Phone:</strong> {recall.phone ?? "Not available"}
            </p>

            <p>
              <strong>Recall type:</strong>{" "}
              {formatStoredText(recall.recallType)}
            </p>

            <p>
              <strong>Recall due:</strong> {formatRecallDueDate(recall.dueDate)}
            </p>

            <p>
              <strong>Opportunity:</strong>{" "}
              {formatStoredText(recall.reason, "Overdue recall")}
            </p>

            <p>
              <strong>Priority:</strong> {recall.priority}
            </p>

            <p>
              <strong>Estimated Value:</strong> ${revenue.toLocaleString()}
            </p>

            <p>
              <strong>Status:</strong> {status}
            </p>

            <p>
              <strong>AI source:</strong>{" "}
              {recommendation.source === "recommended_action"
                ? "Stored recommended_action"
                : recommendation.source === "reason"
                  ? "Stored reason"
                  : "None stored"}
            </p>
          </>
        }
      />

      <RecallActions
        actions={actions}
        workflowStatus={recall.workflowStatus}
        completed={recall.completed}
        telHref={telHref}
        notice={notice}
        busyAction={busyAction}
        note={note}
        snoozeUntil={snoozeUntil}
        onNoteChange={setNote}
        onSnoozeUntilChange={setSnoozeUntil}
        onAction={(id) => {
          void handleAction(id);
        }}
        onContactOutcome={(id) => {
          void runWorkflow("contact_outcome", { contactOutcome: id });
        }}
      />

      <OpportunityActivityTimeline activities={activities} />
    </main>
  );
}
