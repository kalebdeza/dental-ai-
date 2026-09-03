/**
 * Heuristic recall value used when Open Dental does not send a fee.
 * Shared by the UI sync path and the scheduler sync path.
 */
export function estimateRecallRevenue(
  recallType: string | null | undefined
): number {
  const normalized = String(recallType ?? "").toLowerCase();

  if (
    normalized.includes("hygiene") ||
    normalized.includes("prophy") ||
    normalized.includes("cleaning")
  ) {
    return 250;
  }

  if (
    normalized.includes("perio") ||
    normalized.includes("periodontal")
  ) {
    return 350;
  }

  if (
    normalized.includes("exam") ||
    normalized.includes("recall")
  ) {
    return 200;
  }

  return 250;
}
