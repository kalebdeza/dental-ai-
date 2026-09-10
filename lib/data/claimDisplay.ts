export const NOT_AVAILABLE_IN_APP = "Not available in this app";

type NamedPerson = {
  first_name: string;
  last_name: string;
};

export function formatPatientName(
  patient: NamedPerson | null | undefined
): string {
  if (!patient) {
    return "Not available";
  }

  const name = `${patient.first_name} ${patient.last_name}`.trim();
  return name.length > 0 ? name : "Not available";
}

export function formatProviderName(
  provider: NamedPerson | null | undefined
): string {
  return formatPatientName(provider);
}

export function formatProcedureName(
  procedure:
    | { procedure_name?: string | null }
    | null
    | undefined
): string {
  const name = procedure?.procedure_name?.trim();
  return name ? name : "Not available";
}

export function formatClaimDate(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString();
}

export function formatClaimAmount(value: number | null | undefined): string {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "Not available";
  }

  return `$${amount.toLocaleString()}`;
}
