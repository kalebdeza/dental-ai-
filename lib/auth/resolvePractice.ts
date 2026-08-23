export const PRACTICE_ID_HEADER = "x-practice-id";

export type PracticeResolution<TPractice> =
  | { kind: "resolved"; practice: TPractice }
  | { kind: "noAccess" }
  | { kind: "notFound" }
  | { kind: "ambiguous"; practices: TPractice[] };

/**
 * Chooses which of the caller's practices the request applies to.
 *
 * Kept free of IO so the access rules can be tested exhaustively. The
 * caller is responsible for having already narrowed `practices` to the
 * ones this user may reach; a requested id is honoured only if it appears
 * in that list, so this never trusts a client-supplied practice id.
 */
export function resolveCurrentPractice<
  TPractice extends { id: string }
>(
  practices: TPractice[],
  requestedPracticeId?: string | null
): PracticeResolution<TPractice> {
  if (practices.length === 0) {
    return { kind: "noAccess" };
  }

  const requested = requestedPracticeId?.trim();

  if (requested) {
    const match = practices.find(
      (practice) => practice.id === requested
    );

    // Reported as not-found rather than forbidden, so probing ids cannot
    // confirm that another tenant's practice exists.
    return match
      ? { kind: "resolved", practice: match }
      : { kind: "notFound" };
  }

  // A single practice needs no selection, which keeps every existing
  // client working unchanged.
  if (practices.length === 1) {
    return { kind: "resolved", practice: practices[0] };
  }

  return { kind: "ambiguous", practices };
}
