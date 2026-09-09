"use client";

import {
  DESIRED_TREATMENT_STEPS,
  DESIRED_TREATMENT_TERMINAL,
  getPersistedTreatmentStatus,
} from "@/lib/data/treatmentWorkflow";
import { formatActivityTimestamp, formatContactOutcomeLabel } from "@/lib/data/opportunityActivityDisplay";

type Props = {
  workflowStatus: string;
  completed: boolean;
  contactOutcome: string | null;
  snoozedUntil: string | null;
};

export default function TreatmentWorkflowStatus({
  workflowStatus,
  completed,
  contactOutcome,
  snoozedUntil,
}: Props) {
  const stored = getPersistedTreatmentStatus({
    workflow_status: workflowStatus,
    completed,
  });

  return (
    <div
      className="mb-6 rounded-[20px] bg-white p-6"
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,.08)" }}
    >
      <h2 className="mb-1 text-lg font-bold">Workflow</h2>
      <p className="mb-4 text-sm text-slate-500">
        Stored office status is {stored}. Contacted and Scheduled are office
        states, not Open Dental appointment states.
      </p>

      <div className="flex flex-wrap gap-2">
        {DESIRED_TREATMENT_STEPS.map((step, index) => {
          const isStoredCurrent = step === stored;

          return (
            <span
              key={step}
              className={
                isStoredCurrent
                  ? "rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700"
                  : "rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
              }
            >
              {index + 1}. {step}
              {isStoredCurrent ? " · current" : ""}
            </span>
          );
        })}
        <span
          className={
            stored === DESIRED_TREATMENT_TERMINAL
              ? "rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700"
              : "rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
          }
        >
          {DESIRED_TREATMENT_TERMINAL}
          {stored === DESIRED_TREATMENT_TERMINAL ? " · current" : ""}
        </span>
      </div>

      {contactOutcome ? (
        <p className="mt-4 text-sm text-slate-600">
          Latest outcome: {formatContactOutcomeLabel(contactOutcome)}
        </p>
      ) : null}
      {snoozedUntil ? (
        <p className="mt-2 text-sm text-slate-600">
          Snoozed until {formatActivityTimestamp(snoozedUntil)}
        </p>
      ) : null}
    </div>
  );
}
