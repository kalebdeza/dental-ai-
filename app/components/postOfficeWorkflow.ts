export async function postOfficeWorkflow(body: {
  opportunityId: string;
  action: string;
  contactOutcome?: string;
  note?: string;
  snoozedUntil?: string;
}): Promise<{
  opportunity: {
    workflow_status: string;
    completed: boolean;
    contact_outcome: string | null;
    snoozed_until: string | null;
  };
  activities: unknown[];
  message?: string;
}> {
  const response = await fetch("/api/opportunities/workflow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Could not save this workflow action.");
  }

  return data;
}

export function officeWorkflowSuccessMessage(
  action: string,
  extra: { contactOutcome?: string; snoozedUntil?: string } = {}
): string {
  if (action === "mark_contacted") {
    return "Saved: marked contacted.";
  }

  if (action === "add_note") {
    return "Note saved.";
  }

  if (action === "snooze") {
    if (!extra.snoozedUntil) {
      return "Snoozed. This item leaves Today until the selected time.";
    }

    const when = new Date(extra.snoozedUntil);
    const stamp = Number.isNaN(when.getTime())
      ? extra.snoozedUntil
      : when.toLocaleString();
    return `Snoozed until ${stamp}. This item leaves Today until then.`;
  }

  if (action === "contact_outcome") {
    if (extra.contactOutcome === "scheduled") {
      return "Saved: office recorded that the patient was scheduled in the PMS. The app did not create an appointment.";
    }

    return "Saved: contact outcome recorded.";
  }

  if (action === "complete") {
    return "Saved: marked complete.";
  }

  if (action === "dismiss") {
    return "Saved: dismissed from the work queue.";
  }

  return "Saved.";
}

export function toSnoozeIso(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
