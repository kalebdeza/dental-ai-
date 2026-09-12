export function formatScheduleDateTime(
  value: string,
  timeZone: string
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatScheduleTime(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function confirmationLabel(status: string): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "pending":
      return "Awaiting reply";
    case "reschedule_requested":
      return "Reschedule requested";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unconfirmed";
  }
}

export function appointmentStatusLabel(status: string): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    default:
      return "Scheduled";
  }
}

export function confirmationColor(status: string): string {
  switch (status) {
    case "confirmed":
      return "#15803d";
    case "pending":
      return "#b45309";
    case "reschedule_requested":
      return "#1d4ed8";
    case "cancelled":
      return "#b91c1c";
    default:
      return "#475569";
  }
}
