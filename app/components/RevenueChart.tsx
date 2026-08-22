"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", revenue: 3200 },
  { month: "Feb", revenue: 5100 },
  { month: "Mar", revenue: 4700 },
  { month: "Apr", revenue: 8200 },
  { month: "May", revenue: 6900 },
  { month: "Jun", revenue: 1280 },
];

export default function RevenueChart() {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        padding: 24,
        boxShadow: "0 2px 10px rgba(0,0,0,.08)",
        height: 350,
      }}
    >
      <h3 style={{ marginTop: 0 }}>Revenue Recovery Trend</h3>

      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#2563eb"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}