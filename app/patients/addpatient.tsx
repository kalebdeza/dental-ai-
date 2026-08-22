"use client";

import { useState } from "react";

type Props = {
  onAddPatient: (patient: {
    name: string;
    treatment: string;
    revenue: string;
  }) => Promise<void>;
};
export default function AddPatient({ onAddPatient }: Props) {
  const [name, setName] = useState("");
  const [treatment, setTreatment] = useState("");
  const [revenue, setRevenue] = useState("");

  return (
    <div
      style={{
        marginTop: 30,
        padding: 20,
        border: "1px solid #ddd",
        borderRadius: 10,
        maxWidth: 500,
      }}
    >
      <h2>Add Patient</h2>

      <input
        placeholder="Patient Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Treatment"
        value={treatment}
        onChange={(e) => setTreatment(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Revenue"
        value={revenue}
        onChange={(e) => setRevenue(e.target.value)}
      />

      <br /><br />

      <button
        style={{
          background: "#2563eb",
          color: "white",
          border: "none",
          padding: "12px 20px",
          borderRadius: "8px",
          cursor: "pointer",
        }}
        onClick={async () => {
  await onAddPatient({ name, treatment, revenue });

  setName("");
  setTreatment("");
  setRevenue("");
}}
      >
        Add Patient
      </button>
    </div>
  );
}