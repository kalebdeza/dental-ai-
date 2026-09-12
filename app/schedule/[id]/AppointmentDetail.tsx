"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";

import type { SchedulingAppointmentDetail } from "@/lib/data/scheduling";
import {
  appointmentStatusLabel,
  confirmationColor,
  confirmationLabel,
  formatScheduleDateTime,
} from "@/lib/scheduling/display";

export default function AppointmentDetail({
  item: initialItem,
  timezone,
}: {
  item: SchedulingAppointmentDetail;
  timezone: string;
}) {
  const [item, setItem] = useState(initialItem);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reply, setReply] = useState("CONFIRM");

  async function runAction(action: "confirm" | "reschedule" | "cancel") {
    setBusy(action);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/scheduling/${item.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Action failed.");
      }
      setItem(payload.item);
      setNotice(
        action === "confirm"
          ? "Appointment confirmed."
          : action === "reschedule"
            ? "Reschedule options sent through demo SMS."
            : "Cancellation recorded. Recovery job queued."
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function simulateReply() {
    setBusy("inbound");
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/scheduling/demo/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: item.id,
          body: reply,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Demo reply failed.");
      }
      if (payload.item) {
        setItem(payload.item);
      }
      setNotice(
        payload.result?.reply
          ? `Demo patient reply processed: ${payload.result.reply}`
          : "Demo patient reply recorded."
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demo reply failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main>
      <Link href="/schedule" style={{ color: "#2563eb" }}>
        ← Back to schedule
      </Link>
      <h1 style={{ fontSize: 36, margin: "16px 0 8px" }}>{item.patientName}</h1>
      <p style={{ color: "#64748b", fontSize: 18, marginTop: 0 }}>
        {item.appointmentType} with {item.providerName} ·{" "}
        {formatScheduleDateTime(item.startTime, timezone)}
      </p>

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {notice ? <p style={{ color: "#15803d" }}>{notice}</p> : null}

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          margin: "20px 0 28px",
        }}
      >
        <ActionButton
          label="Confirm"
          busy={busy === "confirm"}
          disabled={Boolean(busy)}
          onClick={() => runAction("confirm")}
        />
        <ActionButton
          label="Reschedule"
          busy={busy === "reschedule"}
          disabled={Boolean(busy)}
          onClick={() => runAction("reschedule")}
        />
        <ActionButton
          label="Cancel"
          busy={busy === "cancel"}
          disabled={Boolean(busy)}
          onClick={() => runAction("cancel")}
        />
        <Link href={`/patients/${item.patientId}`} style={secondaryLinkStyle}>
          View patient
        </Link>
        {item.opportunity ? (
          <Link href={item.opportunity.href} style={secondaryLinkStyle}>
            View linked opportunity
          </Link>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
        }}
      >
        <Card title="Appointment">
          <Row label="Status" value={appointmentStatusLabel(item.status)} />
          <Row
            label="Confirmation"
            value={confirmationLabel(item.confirmationStatus)}
            color={confirmationColor(item.confirmationStatus)}
          />
          <Row
            label="Reschedule"
            value={item.rescheduleStatus.replaceAll("_", " ")}
          />
          <Row
            label="Source"
            value={item.source === "demo" ? "Demo" : "Open Dental cache"}
          />
          <Row
            label="When"
            value={`${formatScheduleDateTime(item.startTime, timezone)} – ${formatScheduleDateTime(item.endTime, timezone)}`}
          />
        </Card>

        <Card title="Linked opportunity">
          {item.opportunity ? (
            <>
              <Row label="Type" value={item.opportunity.type} />
              <Row label="Workflow" value={item.opportunity.workflowStatus} />
              <Row
                label="Reason"
                value={item.opportunity.reason || "No reason stored"}
              />
              <Row
                label="Estimated value"
                value={`$${item.opportunity.estimatedValue.toLocaleString()}`}
              />
              <p style={{ color: "#64748b", fontSize: 14 }}>
                Lifecycle: {item.lifecycle.label}
              </p>
              <Lifecycle
                stages={item.lifecycle.stages}
                current={item.lifecycle.stage}
              />
            </>
          ) : (
            <p style={{ color: "#64748b" }}>
              No recall, treatment, or revenue opportunity is linked yet.
            </p>
          )}
        </Card>

        <Card title="Demo SMS reply">
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Simulate a patient text. Nothing is sent to a real phone.
          </p>
          <input
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            style={{
              width: "100%",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              padding: 10,
              marginBottom: 12,
            }}
          />
          <ActionButton
            label="Simulate inbound SMS"
            busy={busy === "inbound"}
            disabled={Boolean(busy)}
            onClick={simulateReply}
          />
        </Card>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
          marginTop: 24,
        }}
      >
        <Card title="SMS history">
          {item.messages.length === 0 ? (
            <p style={{ color: "#64748b" }}>No demo messages yet.</p>
          ) : (
            item.messages.map((message) => (
              <div
                key={message.id}
                style={{
                  borderTop: "1px solid #e2e8f0",
                  padding: "12px 0",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {message.direction === "outbound" ? "Office" : "Patient"} ·{" "}
                  {message.message_type} · {message.status}
                </div>
                <div style={{ marginTop: 6 }}>{message.body}</div>
                {message.provider_message_id ? (
                  <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                    {message.provider} {message.provider_message_id}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </Card>

        <Card title="Scheduling events">
          {item.events.length === 0 ? (
            <p style={{ color: "#64748b" }}>No events recorded.</p>
          ) : (
            item.events.map((event) => (
              <div
                key={event.id}
                style={{
                  borderTop: "1px solid #e2e8f0",
                  padding: "12px 0",
                }}
              >
                <div style={{ fontWeight: 600 }}>{event.event_type}</div>
                <div style={{ color: "#64748b", fontSize: 14 }}>
                  {event.previous_state || "—"} → {event.new_state || "—"} ·{" "}
                  {event.source}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "white",
        borderRadius: 16,
        padding: 24,
        boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: 20 }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#64748b", fontSize: 13 }}>{label}</div>
      <div style={{ fontWeight: 600, color: color ?? "#0f172a" }}>{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  busy,
  disabled,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "#0f172a",
        color: "white",
        border: 0,
        borderRadius: 12,
        padding: "12px 16px",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {busy ? "Working…" : label}
    </button>
  );
}

const secondaryLinkStyle: CSSProperties = {
  background: "white",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "12px 16px",
  fontWeight: 600,
  textDecoration: "none",
};

function Lifecycle({
  stages,
  current,
}: {
  stages: string[];
  current: string;
}) {
  const currentIndex = stages.indexOf(current);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {stages.map((stage, index) => (
        <span
          key={stage}
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: 999,
            background: index <= currentIndex ? "#0f172a" : "#e2e8f0",
            color: index <= currentIndex ? "white" : "#475569",
          }}
        >
          {stage}
        </span>
      ))}
    </div>
  );
}
