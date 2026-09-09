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

export function toSnoozeIso(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
