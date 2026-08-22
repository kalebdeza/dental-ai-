import React from "react";

type OpportunityCardProps = {
  title: string;
  patient?: string;
  type: string;
  status: string;
  priority: string;
  revenue: number;
  details: React.ReactNode;
  recommendation: string;
  primaryAction: string;
  onPrimaryAction?: () => void;
  onComplete?: () => void;
};

export default function OpportunityCard({
  title,
  patient,
  type,
  status,
  priority,
  revenue,
  details,
  recommendation,
  primaryAction,
  onPrimaryAction,
  onComplete,
}: OpportunityCardProps) {
  const safePatient = patient || "Unknown Patient";

  const initials = safePatient
    .split(" ")
    .map((name) => name.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const priorityColor =
    priority === "High"
      ? "#dc2626"
      : priority === "Medium"
      ? "#d97706"
      : "#16a34a";

  const priorityBackground =
    priority === "High"
      ? "#fee2e2"
      : priority === "Medium"
      ? "#fef3c7"
      : "#dcfce7";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: 36,
        boxShadow: "0 10px 30px rgba(15,23,42,.08)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginBottom: 30,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#2563eb",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 22,
          }}
        >
          {initials}
        </div>

        <div>
          <h1 style={{ margin: 0 }}>{safePatient}</h1>

          <div
            style={{
              marginTop: 6,
              color: "#64748b",
            }}
          >
            {title}
          </div>
        </div>
      </div>

      {/* Badges */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 30,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            background: "#dbeafe",
            color: "#2563eb",
            padding: "8px 16px",
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          {status}
        </div>

        <div
          style={{
            background: priorityBackground,
            color: priorityColor,
            padding: "8px 16px",
            borderRadius: 999,
            fontWeight: 700,
          }}
        >
          {priority} Priority
        </div>

        <div
          style={{
            background: "#f1f5f9",
            color: "#334155",
            padding: "8px 16px",
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          {type}
        </div>
      </div>

      {/* Revenue */}
      <div
        style={{
          background: "#f8fafc",
          borderRadius: 18,
          padding: 28,
          marginBottom: 30,
        }}
      >
        <div
          style={{
            color: "#64748b",
            fontWeight: 600,
          }}
        >
          Recoverable Revenue
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 40,
            fontWeight: 700,
            color: "#16a34a",
          }}
        >
          ${revenue.toLocaleString()}
        </div>
      </div>

      {/* Details */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 24,
          marginBottom: 30,
        }}
      >
        <h2 style={{ marginTop: 0 }}>📋 Details</h2>

        <div style={{ lineHeight: 2 }}>
          {details}
        </div>
      </div>

      {/* AI Recommendation */}
      <div
        style={{
          background: "#eff6ff",
          borderLeft: "6px solid #2563eb",
          borderRadius: 12,
          padding: 24,
          marginBottom: 36,
        }}
      >
        <h2 style={{ marginTop: 0 }}>🤖 AI Recommendation</h2>

        <p
          style={{
            marginBottom: 0,
            lineHeight: 1.8,
            color: "#334155",
          }}
        >
          {recommendation}
        </p>
      </div>

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          gap: 16,
        }}
      >
        <button
          onClick={onPrimaryAction}
          style={{
            flex: 1,
            padding: "16px",
            border: "none",
            borderRadius: 12,
            background: "#2563eb",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {primaryAction}
        </button>

        <button
          onClick={onComplete}
          style={{
            flex: 1,
            padding: "16px",
            border: "none",
            borderRadius: 12,
            background: "#16a34a",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ✅ Mark Complete
        </button>
      </div>
    </div>
  );
}