"use client";

import { useState } from "react";

type Props = {
  onAddClaim: (claim: {
    patient_name: string;
    insurance_company: string;
    procedure: string;
    amount: number;
    status: string;
    submitted_date: string;
  }) => Promise<void>;
};

export default function AddClaim({ onAddClaim }: Props) {
  const [patientName, setPatientName] = useState("");
  const [insuranceCompany, setInsuranceCompany] = useState("");
  const [procedure, setProcedure] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("Pending");
  const [submittedDate, setSubmittedDate] = useState("");

  return (
    <div style={{ marginBottom: "30px" }}>
      <h2>Add Insurance Claim</h2>

      <input
        placeholder="Patient Name"
        value={patientName}
        onChange={(e) => setPatientName(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Insurance Company"
        value={insuranceCompany}
        onChange={(e) => setInsuranceCompany(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Procedure"
        value={procedure}
        onChange={(e) => setProcedure(e.target.value)}
      />

      <br /><br />

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <br /><br />

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option>Pending</option>
        <option>Approved</option>
        <option>Denied</option>
      </select>

      <br /><br />

      <input
        type="date"
        required
        value={submittedDate}
        onChange={(e) => setSubmittedDate(e.target.value)}
      />

      <br /><br />

      <button
  onClick={async () => {
    console.log("Submitted Date:", submittedDate);

    await onAddClaim({
      patient_name: patientName,
      insurance_company: insuranceCompany,
      procedure,
      amount: Number(amount),
      status,
      submitted_date: submittedDate,
    });

    setPatientName("");
    setInsuranceCompany("");
    setProcedure("");
    setAmount("");
    setStatus("Pending");
    setSubmittedDate("");
  }}
>
  Add Claim
</button>
    </div>
  );
}