"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { SchedulingAppointmentItem } from "@/lib/data/scheduling";
import {
  appointmentStatusLabel,
  confirmationColor,
  confirmationLabel,
  formatScheduleDateTime,
  formatScheduleTime,
} from "@/lib/scheduling/display";

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function sameDay(value: string, day: string, timeZone: string): boolean {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
  return formatted === day;
}

function hourOffset(value: string, timeZone: string): number {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value))
  );
  const minute = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      minute: "2-digit",
    }).format(new Date(value))
  );
  return hour + minute / 60;
}

function todayInZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function ScheduleBoard({
  practice,
  initialAppointments,
}: {
  practice: { id: string; name: string; timezone: string };
  initialAppointments: SchedulingAppointmentItem[];
}) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState(() => todayInZone(practice.timezone));

  async function seedDemo() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/scheduling/demo/seed", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Demo seed failed.");
      }
      const refreshed = await fetch("/api/scheduling");
      const board = await refreshed.json();
      if (!refreshed.ok) {
        throw new Error(board.message ?? "Failed to reload schedule.");
      }
      setAppointments(board.appointments ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demo seed failed.");
    } finally {
      setBusy(false);
    }
  }

  const dayAppointments = useMemo(
    () => appointments.filter((item) => sameDay(item.startTime, day, practice.timezone)),
    [appointments, day, practice.timezone]
  );
  const upcoming = useMemo(
    () =>
      appointments
        .filter((item) => item.status !== "cancelled")
        .slice()
        .sort((left, right) => left.startTime.localeCompare(right.startTime))
        .slice(0, 8),
    [appointments]
  );

  return (
    <main>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 36, margin: 0 }}>📅 Scheduling</h1>
          <p style={{ color: "#64748b", fontSize: 18, marginTop: 8 }}>
            Demo schedule and confirmation workflows for {practice.name}. Open
            Dental stays read-only; no live office writes and no real texts.
          </p>
        </div>
        <button
          type="button"
          onClick={seedDemo}
          disabled={busy}
          style={{
            background: "#0f172a",
            color: "white",
            border: 0,
            borderRadius: 12,
            padding: "12px 16px",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Creating demo…" : "Create demo appointments"}
        </button>
      </div>

      {error ? (
        <p style={{ color: "#b91c1c", marginBottom: 16 }}>{error}</p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
          gap: 24,
        }}
      >
        <section
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              gap: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 22 }}>Day schedule</h2>
            <input
              type="date"
              value={day}
              onChange={(event) => setDay(event.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "8px 10px",
              }}
            />
          </div>

          <div style={{ position: "relative", minHeight: HOURS.length * 56 }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{
                  height: 56,
                  borderTop: "1px solid #e2e8f0",
                  color: "#94a3b8",
                  fontSize: 12,
                  paddingTop: 4,
                }}
              >
                {hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
              </div>
            ))}

            {dayAppointments.map((item) => {
              const start = hourOffset(item.startTime, practice.timezone);
              const end = hourOffset(item.endTime, practice.timezone);
              const top = Math.max(0, (start - 8) * 56);
              const height = Math.max(40, (end - start) * 56);
              return (
                <Link
                  key={item.id}
                  href={`/schedule/${item.id}`}
                  style={{
                    position: "absolute",
                    left: 72,
                    right: 8,
                    top,
                    height,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderLeft: `4px solid ${confirmationColor(item.confirmationStatus)}`,
                    borderRadius: 10,
                    padding: "8px 10px",
                    textDecoration: "none",
                    color: "#0f172a",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {formatScheduleTime(item.startTime, practice.timezone)} ·{" "}
                    {item.patientName}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {item.appointmentType} · {item.providerName}
                  </div>
                </Link>
              );
            })}

            {dayAppointments.length === 0 ? (
              <div
                style={{
                  position: "absolute",
                  inset: 48,
                  color: "#64748b",
                  textAlign: "center",
                }}
              >
                No appointments on this day. Create demo appointments to test
                confirmation and reschedule SMS.
              </div>
            ) : null}
          </div>
        </section>

        <aside
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 22 }}>Upcoming</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {upcoming.map((item) => (
              <Link
                key={item.id}
                href={`/schedule/${item.id}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "#0f172a",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 600 }}>{item.patientName}</div>
                <div style={{ color: "#64748b", fontSize: 14, margin: "4px 0 8px" }}>
                  {formatScheduleDateTime(item.startTime, practice.timezone)}
                  <br />
                  {item.appointmentType} · {item.providerName}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Chip
                    label={appointmentStatusLabel(item.status)}
                    color="#334155"
                  />
                  <Chip
                    label={confirmationLabel(item.confirmationStatus)}
                    color={confirmationColor(item.confirmationStatus)}
                  />
                  {item.source === "demo" ? (
                    <Chip label="Demo" color="#7c3aed" />
                  ) : null}
                  {item.opportunity ? (
                    <Chip label={item.opportunity.type} color="#0369a1" />
                  ) : null}
                </div>
              </Link>
            ))}
            {upcoming.length === 0 ? (
              <p style={{ color: "#64748b" }}>No upcoming appointments.</p>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        color,
        background: "#f8fafc",
        border: `1px solid ${color}33`,
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}
