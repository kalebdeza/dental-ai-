"use client";

import { useEffect, useState } from "react";
import StatCard from "./components/StatCard";
import RevenueChart from "./components/RevenueChart";
import OpportunityChart from "./components/OpportunityChart";
import AIInsights from "./components/AIInsights";
import AIRevenueBrief from "./components/AIRevenueBrief";
type DashboardData = {
  totalRecoverableRevenue: number;
  claimsRevenue: number;
  recallRevenue: number;
  treatmentRevenue: number;

  claimOpportunities: number;
  recallPatients: number;
  treatmentPatients: number;

  totalPatients: number;

  priorityPatients: {
  patientId: string;
  name: string;
  type: string;
  revenue: number;
  priority: string;
}[];
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      const response = await fetch("/api/dashboard");
      const result = await response.json();
      setData(result);
    }

    loadDashboard();
  }, []);

  if (!data) {
    return <h2>Loading Revenue Command Center...</h2>;
  }

  return (
    <main>
      <div
  style={{
    background:
      "linear-gradient(135deg,#0f172a 0%, #1e3a8a 100%)",
    color: "white",
    borderRadius: 24,
    padding: 40,
    marginBottom: 32,
    boxShadow: "0 20px 40px rgba(15,23,42,.25)",
  }}
>
  <div
    style={{
      fontSize: 14,
      opacity: 0.8,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 12,
    }}
  >
    Dental Revenue AI
  </div>

  <h1
    style={{
      fontSize: 42,
      margin: 0,
      fontWeight: 800,
    }}
  >
    Revenue Command Center
  </h1>

  <p
    style={{
      fontSize: 20,
      opacity: 0.9,
      marginTop: 16,
      maxWidth: 700,
      lineHeight: 1.6,
    }}
  >
    Your AI has identified{" "}
    <strong>
      ${data.totalRecoverableRevenue.toLocaleString()}
    </strong>{" "}
    in recoverable revenue across claims, recalls, and treatment opportunities.
  </p>
</div>
<AIRevenueBrief
  totalRecoverableRevenue={data.totalRecoverableRevenue}
  claimsRevenue={data.claimsRevenue}
  recallRevenue={data.recallRevenue}
  treatmentRevenue={data.treatmentRevenue}
/>

<div
  style={{
    marginTop: 30,
    background: "#ffffff",
    borderRadius: 24,
    padding: 32,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,.08)",
  }}
>
  <h2
    style={{
      marginTop: 0,
      marginBottom: 24,
      fontSize: 28,
    }}
  >
    🎯 Today's Work Queue
  </h2>

  <div
    style={{
      display: "grid",
      gap: 18,
    }}
  >

    <div
      style={{
        padding: 20,
        borderRadius: 16,
        background: "#f8fafc",
      }}
    >
      <strong>📞 Call overdue recall patients</strong>

      <div style={{ marginTop: 8 }}>
        {data.recallPatients} patients worth $
        {data.recallRevenue.toLocaleString()}
      </div>
    </div>

    <div
      style={{
        padding: 20,
        borderRadius: 16,
        background: "#f8fafc",
      }}
    >
      <strong>📄 Review insurance claims</strong>

      <div style={{ marginTop: 8 }}>
        {data.claimOpportunities} claims worth $
        {data.claimsRevenue.toLocaleString()}
      </div>
    </div>

    <div
      style={{
        padding: 20,
        borderRadius: 16,
        background: "#f8fafc",
      }}
    >
      <strong>🦷 Schedule unscheduled treatment</strong>

      <div style={{ marginTop: 8 }}>
        {data.treatmentPatients} opportunities worth $
        {data.treatmentRevenue.toLocaleString()}
      </div>
    </div>

  </div>
</div>
      {/* KPI Cards */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
          gap: 20,
        }}
      >
        <StatCard
          title="💰 Total Recoverable Revenue"
          value={`$${data.totalRecoverableRevenue.toLocaleString()}`}
          color="#16a34a"
        />

        <StatCard
          title="📄 Claims Recovery"
          value={`$${data.claimsRevenue.toLocaleString()}`}
          color="#2563eb"
        />

        <StatCard
          title="📞 Recall Recovery"
          value={`$${data.recallRevenue.toLocaleString()}`}
          color="#9333ea"
        />

        <StatCard
          title="🦷 Treatment Recovery"
          value={`$${data.treatmentRevenue.toLocaleString()}`}
          color="#dc2626"
        />

        <StatCard
          title="👥 Total Patients"
          value={data.totalPatients}
          color="#ea580c"
        />
      </div>

      {/* Charts */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 20,
          marginTop: 30,
        }}
      >
        <RevenueChart />
        <OpportunityChart />
      </div>

{/* Opportunity Pipeline */}

<div
  style={{
    marginTop: 32,
    background: "#ffffff",
    borderRadius: 24,
    padding: 32,
    boxShadow: "0 10px 30px rgba(15,23,42,.08)",
    border: "1px solid #e2e8f0",
  }}
>
  <h2
    style={{
      marginTop: 0,
      marginBottom: 24,
      fontSize: 28,
    }}
  >
    Revenue Opportunity Pipeline
  </h2>

  {[
    {
      label: "Insurance Claims",
      count: data.claimOpportunities,
      revenue: data.claimsRevenue,
      color: "#2563eb",
    },
    {
      label: "Recall Patients",
      count: data.recallPatients,
      revenue: data.recallRevenue,
      color: "#9333ea",
    },
    {
      label: "Treatment Plans",
      count: data.treatmentPatients,
      revenue: data.treatmentRevenue,
      color: "#dc2626",
    },
  ].map((item) => {
    const percent =
      data.totalRecoverableRevenue === 0
        ? 0
        : (item.revenue / data.totalRecoverableRevenue) * 100;

    return (
      <div
        key={item.label}
        style={{
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 10,
            fontWeight: 700,
          }}
        >
          <span>{item.label}</span>

          <span>
            ${item.revenue.toLocaleString()}
          </span>
        </div>

        <div
          style={{
            height: 14,
            background: "#e2e8f0",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              background: item.color,
              borderRadius: 999,
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            color: "#64748b",
            fontSize: 14,
          }}
        >
          <span>{item.count} Opportunities</span>

          <span>{percent.toFixed(0)}% of Revenue</span>
        </div>
      </div>
    );
  })}
</div>

<AIInsights
  totalRecoverableRevenue={data.totalRecoverableRevenue}
  claimsRevenue={data.claimsRevenue}
  recallRevenue={data.recallRevenue}
  treatmentRevenue={data.treatmentRevenue}
  claimOpportunities={data.claimOpportunities}
  recallPatients={data.recallPatients}
  treatmentPatients={data.treatmentPatients}
/>

{/* Quick Actions */}

<div
  style={{
    marginTop: 32,
    marginBottom: 32,
    background: "#ffffff",
    borderRadius: 24,
    padding: 32,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,.08)",
  }}
>
  <h2
    style={{
      marginTop: 0,
      marginBottom: 24,
      fontSize: 28,
    }}
  >
    Quick Actions
  </h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
      gap: 20,
    }}
  >
    <a href="/claims" style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "#eff6ff",
          borderRadius: 18,
          padding: 24,
          color: "#1d4ed8",
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        📄
        <br /><br />
        Review Claims
      </div>
    </a>

    <a href="/recall" style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "#faf5ff",
          borderRadius: 18,
          padding: 24,
          color: "#7e22ce",
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        📞
        <br /><br />
        Recall Patients
      </div>
    </a>

    <a href="/treatment" style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "#fef2f2",
          borderRadius: 18,
          padding: 24,
          color: "#dc2626",
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        🦷
        <br /><br />
        Schedule Treatment
      </div>
    </a>

    <a href="/scan" style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "#ecfdf5",
          borderRadius: 18,
          padding: 24,
          color: "#15803d",
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        🤖
        <br /><br />
        Run Revenue Scan
      </div>
    </a>
  </div>
</div>

<div
  style={{
    marginTop: 32,
    background: "#ffffff",
    borderRadius: 24,
    padding: 32,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,.08)",
  }}
>
  <h2
    style={{
      marginTop: 0,
      marginBottom: 24,
      fontSize: 28,
    }}
  >
    🔥 Today's Highest Priority Patients
  </h2>

{data.priorityPatients.map((patient, index) => (
  <div
    key={index}
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "18px 0",
      borderBottom: "1px solid #e2e8f0",
    }}
  >
    <div>
      <div
        style={{
          fontWeight: 700,
          fontSize: 18,
        }}
      >
        {patient.name}
      </div>

      <div
        style={{
          color: "#64748b",
          marginTop: 4,
        }}
      >
        {patient.type} • {patient.priority} Priority
      </div>
    </div>

    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#16a34a",
        }}
      >
        ${patient.revenue.toLocaleString()}
      </div>

      <button
        style={{
          background: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: 10,
          padding: "10px 18px",
          cursor: "pointer",
          fontWeight: 700,
        }}
        onClick={() => {
  if ("patientId" in patient) {
    window.location.href = `/patients/${patient.patientId}`;
  }
}}
      >
        Open
      </button>
    </div>
  </div>
))}
 
</div>

{/* AI Mission Control */}

<div
  style={{
    marginTop: 32,
    background: "linear-gradient(135deg,#0f172a,#1e293b)",
    color: "white",
    borderRadius: 24,
    padding: 36,
    boxShadow: "0 20px 40px rgba(15,23,42,.25)",
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 30,
    }}
  >
    <div>
      <div
        style={{
          fontSize: 13,
          opacity: .7,
          letterSpacing: ".1em",
          textTransform: "uppercase",
        }}
      >
        Artificial Intelligence
      </div>

      <h2
        style={{
          margin: "8px 0 0",
          fontSize: 30,
        }}
      >
        Today's AI Priorities
      </h2>
    </div>

    <div
      style={{
        background: "#22c55e",
        color: "white",
        padding: "8px 18px",
        borderRadius: 999,
        fontWeight: 700,
      }}
    >
      AI Active
    </div>
  </div>

  <div
    style={{
      display: "grid",
      gap: 18,
    }}
  >
    <div>
      🔥 Recover{" "}
      <strong>
        ${data.treatmentRevenue.toLocaleString()}
      </strong>{" "}
      by scheduling unscheduled treatment.
    </div>

    <div>
      📄 Process{" "}
      <strong>{data.claimOpportunities}</strong>{" "}
      insurance claims worth{" "}
      <strong>
        ${data.claimsRevenue.toLocaleString()}
      </strong>.
    </div>

    <div>
      📞 Contact{" "}
      <strong>{data.recallPatients}</strong>{" "}
      overdue recall patients representing{" "}
      <strong>
        ${data.recallRevenue.toLocaleString()}
      </strong>.
    </div>

    <div>
      💰 Total recoverable opportunity:
      <div
        style={{
          fontSize: 42,
          fontWeight: 800,
          marginTop: 10,
          color: "#22c55e",
        }}
      >
        ${data.totalRecoverableRevenue.toLocaleString()}
      </div>
    </div>
  </div>
</div>

{/* Recent Activity */}

<div
  style={{
    marginTop: 32,
    background: "#ffffff",
    borderRadius: 24,
    padding: 32,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,.08)",
  }}
>
  <h2
    style={{
      marginTop: 0,
      marginBottom: 24,
      fontSize: 28,
    }}
  >
    Recent Activity
  </h2>

  {[
    {
      icon: "📄",
      title: `${data.claimOpportunities} insurance claims ready for review`,
      time: "Updated just now",
      color: "#2563eb",
    },
    {
      icon: "📞",
      title: `${data.recallPatients} recall patients identified`,
      time: "AI scan completed",
      color: "#9333ea",
    },
    {
      icon: "🦷",
      title: `${data.treatmentPatients} treatment opportunities detected`,
      time: "Today's analysis",
      color: "#dc2626",
    },
    {
      icon: "🤖",
      title: `Potential revenue: $${data.totalRecoverableRevenue.toLocaleString()}`,
      time: "AI recommendation generated",
      color: "#16a34a",
    },
  ].map((item) => (
    <div
      key={item.title}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "18px 0",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 16,
          background: item.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          color: "white",
          marginRight: 20,
        }}
      >
        {item.icon}
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          {item.title}
        </div>

        <div
          style={{
            color: "#64748b",
            fontSize: 14,
          }}
        >
          {item.time}
        </div>
      </div>
    </div>
  ))}
</div>
</main>
  );
}