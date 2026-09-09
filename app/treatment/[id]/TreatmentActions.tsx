"use client";

import OfficeWorkflowActions, {
  type OfficeActionId,
} from "@/app/components/OfficeWorkflowActions";
import {
  getTreatmentContactOutcomes,
  type TreatmentWorkflowAction,
} from "@/lib/data/treatmentWorkflow";

type Props = {
  actions: TreatmentWorkflowAction[];
  workflowStatus: string;
  completed: boolean;
  telHref: string | null;
  notice: string | null;
  busyAction: string | null;
  note: string;
  snoozeUntil: string;
  onNoteChange: (value: string) => void;
  onSnoozeUntilChange: (value: string) => void;
  onAction: (id: OfficeActionId) => void;
  onContactOutcome: (id: string) => void;
};

export default function TreatmentActions({
  actions,
  workflowStatus,
  completed,
  telHref,
  notice,
  busyAction,
  note,
  snoozeUntil,
  onNoteChange,
  onSnoozeUntilChange,
  onAction,
  onContactOutcome,
}: Props) {
  return (
    <OfficeWorkflowActions
      description="Call uses the stored patient phone and does not mark Contacted. Treatment scheduling stays in the practice system."
      actions={actions}
      contactOutcomes={getTreatmentContactOutcomes({
        workflowStatus,
        completed,
      })}
      telHref={telHref}
      notice={notice}
      busyAction={busyAction}
      note={note}
      snoozeUntil={snoozeUntil}
      onNoteChange={onNoteChange}
      onSnoozeUntilChange={onSnoozeUntilChange}
      onAction={onAction}
      onContactOutcome={onContactOutcome}
    />
  );
}
