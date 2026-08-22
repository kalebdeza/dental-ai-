"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Task = {
  id: string;
  type: string;
  patient: string;
  description: string;
  revenue: number;
  priority: string;
};

export default function TaskCenter() {
  const [tasks, setTasks] = useState<Task[]>([]);
const router = useRouter();
  const totalRevenue = tasks.reduce(
    (sum, task) => sum + task.revenue,
    0
  );

  const highPriority = tasks.filter(
    (task) => task.priority === "High"
  ).length;

  useEffect(() => {
    async function loadTasks() {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data);
    }

    loadTasks();
  }, []);

  return (
    <main style={{ padding: 30 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>
        🤖 AI Task Center
      </h1>

      <p
        style={{
          color: "#64748b",
          marginBottom: 30,
          fontSize: 18,
        }}
      >
        AI has prioritized every revenue opportunity across your
        practice.
      </p>

      {/* KPI Cards */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 20,
          marginBottom: 30,
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 2px 10px rgba(0,0,0,.08)",
          }}
        >
          <h3 style={{ margin: 0 }}>📋 Total Tasks</h3>
          <h1>{tasks.length}</h1>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 2px 10px rgba(0,0,0,.08)",
          }}
        >
          <h3 style={{ margin: 0 }}>🔴 High Priority</h3>
          <h1>{highPriority}</h1>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 2px 10px rgba(0,0,0,.08)",
          }}
        >
          <h3 style={{ margin: 0 }}>💰 Recoverable Revenue</h3>
          <h1>${totalRevenue.toLocaleString()}</h1>
        </div>
      </div>

      {/* AI Task Cards */}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              background: "white",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 2px 10px rgba(0,0,0,.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  borderRadius: 999,
                  background:
                    task.priority === "High"
                      ? "#fee2e2"
                      : task.priority === "Medium"
                      ? "#fef3c7"
                      : "#dcfce7",
                  color:
                    task.priority === "High"
                      ? "#dc2626"
                      : task.priority === "Medium"
                      ? "#ca8a04"
                      : "#16a34a",
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                {task.priority}
              </div>

              <h2
                style={{
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                {task.patient}
              </h2>

              <div
                style={{
                  color: "#2563eb",
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                {task.type}
              </div>

              <p
                style={{
                  color: "#64748b",
                  marginBottom: 18,
                }}
              >
                {task.description}
              </p>

              <h2
                style={{
                  color: "#16a34a",
                  margin: 0,
                }}
              >
                ${task.revenue.toLocaleString()}
              </h2>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <button
  onClick={() => {
    if (task.type === "Claim") {
      router.push(`/opportunities/${task.id}`);
    } else if (task.type === "Recall") {
      router.push(`/recall/${task.id}`);
    } else if (task.type === "Treatment") {
      router.push(`/treatment/${task.id}`);
    }
  }}
  style={{
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 10,
    padding: "12px 20px",
    cursor: "pointer",
    fontWeight: 600,
  }}
>
  Review
</button>
              <button
                style={{
                  background: "#16a34a",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 20px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Complete
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}