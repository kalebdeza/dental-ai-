"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OpportunityCard from "@/app/components/OpportunityCard";
import OpportunityActivityTimeline from "@/app/components/OpportunityActivityTimeline";
import TreatmentActions from "./TreatmentActions";
import TreatmentWorkflowStatus from "./TreatmentWorkflowStatus";
import {
  postOfficeWorkflow,
  toSnoozeIso,
} from "@/app/components/postOfficeWorkflow";
import type { OfficeActionId } from "@/app/components/OfficeWorkflowActions";
import {
  formatProcedureLabel,
  formatStoredText,
  formatTreatmentDate,
  getPersistedTreatmentStatus,
  getTreatmentWorkflowActions,
  storedTreatmentRecommendation,
  toTelHref,
  type TreatmentOpportunityApiItem,
} from "@/lib/data/treatmentWorkflow";
import type { OpportunityActivityRow } from "@/lib/data/opportunityWorkflow";

export default function TreatmentDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [opportunity, setOpportunity] =
    useState<TreatmentOpportunityApiItem | null>(null);
  const [activities, setActivities] = useState<OpportunityActivityRow[]>([]);
  const [loadState, setLoadState] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [snoozeUntil, setSnoozeUntil] = useState("");

  async function loadOpportunity() {
    const res = await fetch(`/api/treatment?id=${String(params.id)}`);

    if (!res.ok) {
      if (res.status === 404) {
        setOpportunity(null);
        setActivities([]);
        setLoadState("missing");
        return;
      }
      throw new Error("Failed to load treatment opportunity.");
    }

    const data = await res.json();
    setOpportunity(data.item ?? null);
    setActivities(Array.isArray(data.activities) ? data.activities : []);
    setLoadState(data.item ? "ready" : "missing");
  }

  useEffect(() => {
    async function run() {
      try {
        await loadOpportunity();
      } catch {
        console.error("Failed to load treatment opportunity.");
        setOpportunity(null);
        setLoadState("error");
      }
    }

    void run();
  }, [params.id]);

  async function runWorkflow(
    action: string,
    extra: { contactOutcome?: string; snoozedUntil?: string } = {}
  ) {
    if (!opportunity) {
      return;
    }

    try {
      setBusyAction(
        extra.contactOutcome ? `outcome:${extra.contactOutcome}` : action
      );
      setNotice(null);

      await postOfficeWorkflow({
        opportunityId: opportunity.id,
        action,
        note: note.trim() || undefined,
        ...extra,
      });

      setNote("");
      setSnoozeUntil("");
      if (action === "dismiss" || action === "complete") {
        router.push("/treatment");
        return;
      }

      await loadOpportunity();
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
    if (id === "call" || id === "schedule") {
      if (id === "schedule") {
        setNotice(
          "Schedule treatment in the practice management system. This app cannot create appointments and will not mark the opportunity scheduled from this button."
        );
      }
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
        "Dismiss this treatment from the work queue? It stays in the database and will not come back on the next scan."
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

  if (loadState !== "ready" || !opportunity) {
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
            ? "Could not load this treatment opportunity."
            : "Treatment opportunity not found."}
        </h2>
      </main>
    );
  }

  const revenue = Number(opportunity.estimated_value ?? 0);
  const status = getPersistedTreatmentStatus({
    workflow_status: opportunity.workflowStatus,
    completed: opportunity.completed,
  });
  const recommendation = storedTreatmentRecommendation(
    opportunity.recommendedAction,
    opportunity.reason
  );
  const actions = getTreatmentWorkflowActions({
    phone: opportunity.phone,
    workflowStatus: opportunity.workflowStatus,
    completed: opportunity.completed,
  });
  const telHref = toTelHref(opportunity.phone);
  const procedureLabel = formatProcedureLabel(
    opportunity.procedureCode,
    opportunity.procedureDescription
  );

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
        Treatment Action Center
      </p>

      <TreatmentWorkflowStatus
        workflowStatus={opportunity.workflowStatus}
        completed={opportunity.completed}
        contactOutcome={opportunity.contactOutcome}
        snoozedUntil={opportunity.snoozedUntil}
      />

      <OpportunityCard
        title="Treatment Opportunity"
        patient={opportunity.patient}
        type={opportunity.opportunity_type}
        status={status}
        priority={opportunity.priority}
        revenue={revenue}
        recommendation={recommendation.text}
        primaryAction="Call Patient"
        showFooterActions={false}
        details={
          <>
            <p>
              <strong>Patient:</strong> {opportunity.patient}
            </p>

            <p>
              <strong>Phone:</strong> {opportunity.phone ?? "Not available"}
            </p>

            <p>
              <strong>Procedure:</strong> {procedureLabel}
            </p>

            <p>
              <strong>Procedure fee:</strong>{" "}
              {opportunity.procedureFee == null
                ? "Not available"
                : `$${opportunity.procedureFee.toLocaleString()}`}
            </p>

            <p>
              <strong>Tooth / surface:</strong>{" "}
              {[opportunity.tooth, opportunity.surface]
                .filter(Boolean)
                .join(" / ") || "Not available"}
            </p>

            <p>
              <strong>Procedure status:</strong>{" "}
              {formatStoredText(opportunity.procedureStatus)}
            </p>

            <p>
              <strong>Patient next visit:</strong>{" "}
              {formatTreatmentDate(opportunity.nextVisit)}
            </p>

            <p>
              <strong>Opportunity:</strong>{" "}
              {formatStoredText(opportunity.reason, "Treatment opportunity")}
            </p>

            <p>
              <strong>Priority:</strong> {opportunity.priority}
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

      <TreatmentActions
        actions={actions}
        workflowStatus={opportunity.workflowStatus}
        completed={opportunity.completed}
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
