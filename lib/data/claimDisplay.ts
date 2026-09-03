type NamedPatient = {
  first_name: string;
  last_name: string;
};

export function formatPatientName(
  patient: NamedPatient | null | undefined
): string {
  if (!patient) {
    return "Not available";
  }

  const name = `${patient.first_name} ${patient.last_name}`.trim();
  return name.length > 0 ? name : "Not available";
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
