import type {
  AppointmentRow,
  LinkedOpportunity,
  SchedulingLifecycleStage,
} from "./types.ts";

const STAGES: SchedulingLifecycleStage[] = [
  "opportunity",
  "outreach",
  "scheduled",
  "confirmed",
  "completed",
];

export function schedulingLifecycle(input: {
  appointment?: Pick<
    AppointmentRow,
    "confirmation_status" | "status" | "opportunity_id"
  > | null;
  opportunity?: Pick<
    LinkedOpportunity,
    "workflow_status" | "contact_outcome" | "completed"
  > | null;
  hasOutreach?: boolean;
}): {
  stage: SchedulingLifecycleStage;
  stages: SchedulingLifecycleStage[];
  label: string;
} {
  if (
    input.appointment?.status === "cancelled" ||
    input.appointment?.confirmation_status === "cancelled"
  ) {
    return {
      stage: "cancelled",
      stages: STAGES,
      label: "Cancelled",
    };
  }

  if (
    input.appointment?.status === "completed" ||
    input.opportunity?.workflow_status === "completed" ||
    input.opportunity?.completed
  ) {
    return {
      stage: "completed",
      stages: STAGES,
      label: "Completed",
    };
  }

  if (input.appointment?.confirmation_status === "confirmed") {
    return {
      stage: "confirmed",
      stages: STAGES,
      label: "Appointment confirmed",
    };
  }

  if (input.appointment) {
    return {
      stage: "scheduled",
      stages: STAGES,
      label: "Appointment scheduled",
    };
  }

  if (
    input.hasOutreach ||
    input.opportunity?.workflow_status === "contacted" ||
    input.opportunity?.contact_outcome
  ) {
    return {
      stage: "outreach",
      stages: STAGES,
      label: "Outreach sent",
    };
  }

  if (input.opportunity) {
    return {
      stage: "opportunity",
      stages: STAGES,
      label: "Opportunity identified",
    };
  }

  return {
    stage: "scheduled",
    stages: STAGES,
    label: "Scheduled",
  };
}
