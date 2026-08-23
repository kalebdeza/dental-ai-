/**
 * Open Dental status vocabularies.
 *
 * Open Dental transmits short codes ("C", "TP") rather than readable names,
 * and each entity uses a different convention: procedures and claims use
 * letter codes, treatment plans use whole words, and recalls use an integer
 * foreign key. Normalizing here keeps that per-entity inconsistency at the
 * integration boundary so business logic never encodes one vendor's enum.
 *
 * Codes are taken from the published API reference:
 *   https://www.opendental.com/site/apiprocedurelogs.html
 *   https://www.opendental.com/site/apiclaims.html
 *   https://www.opendental.com/site/apirecalls.html
 *
 * This module is intentionally dependency-free so it can be unit tested
 * without a database, a network, or environment variables.
 */

// =========================================
// Procedures
// =========================================

export const PROCEDURE_STATUS = {
  Completed: "Completed",
  TreatmentPlanned: "TreatmentPlanned",
  TreatmentPlannedInactive: "TreatmentPlannedInactive",
  ExistingCurrentProvider: "ExistingCurrentProvider",
  ExistingOtherProvider: "ExistingOtherProvider",
  ReferredOut: "ReferredOut",
  Deleted: "Deleted",
  Condition: "Condition",
  Unknown: "Unknown",
} as const;

export type ProcedureStatus =
  (typeof PROCEDURE_STATUS)[keyof typeof PROCEDURE_STATUS];

const PROCEDURE_STATUS_BY_CODE = {
  c: PROCEDURE_STATUS.Completed,
  tp: PROCEDURE_STATUS.TreatmentPlanned,
  tpi: PROCEDURE_STATUS.TreatmentPlannedInactive,
  ec: PROCEDURE_STATUS.ExistingCurrentProvider,
  eo: PROCEDURE_STATUS.ExistingOtherProvider,
  r: PROCEDURE_STATUS.ReferredOut,
  d: PROCEDURE_STATUS.Deleted,
  cn: PROCEDURE_STATUS.Condition,
} as const;

/**
 * The eight documented ProcStatus codes, in the casing Open Dental uses.
 */
export const OPEN_DENTAL_PROC_STATUS_CODES = [
  "C",
  "TP",
  "TPi",
  "EC",
  "EO",
  "R",
  "D",
  "Cn",
] as const;

export type OpenDentalProcStatus =
  (typeof OPEN_DENTAL_PROC_STATUS_CODES)[number];

export function mapProcedureStatus(
  raw: string | null | undefined
): ProcedureStatus {
  return (
    PROCEDURE_STATUS_BY_CODE[
      lookupKey(raw) as keyof typeof PROCEDURE_STATUS_BY_CODE
    ] ?? PROCEDURE_STATUS.Unknown
  );
}

/**
 * Work this practice completed and may therefore bill for.
 *
 * Deliberately excludes ExistingCurrentProvider and ExistingOtherProvider:
 * those record treatment performed previously or by someone else, so billing
 * against them would invent revenue. Condition is a charted observation
 * rather than a procedure, and Deleted is self-explanatory.
 */
export function isBillableCompletedProcedure(
  status: string | null | undefined
): boolean {
  return status === PROCEDURE_STATUS.Completed;
}

/**
 * Treatment still genuinely outstanding, and therefore a real opportunity.
 *
 * Only actively treatment-planned work qualifies. TreatmentPlannedInactive
 * belongs to a plan the patient declined, and every other status is either
 * already done, referred elsewhere, or not a procedure at all.
 */
export function isOutstandingPlannedTreatment(
  status: string | null | undefined
): boolean {
  return status === PROCEDURE_STATUS.TreatmentPlanned;
}

// =========================================
// Claims
// =========================================

export const CLAIM_STATUS = {
  Unsent: "Unsent",
  HoldUntilPrimaryReceived: "HoldUntilPrimaryReceived",
  WaitingInQueue: "WaitingInQueue",
  HoldForInProcess: "HoldForInProcess",
  Sent: "Sent",
  Received: "Received",
  Unknown: "Unknown",
} as const;

export type ClaimStatus =
  (typeof CLAIM_STATUS)[keyof typeof CLAIM_STATUS];

const CLAIM_STATUS_BY_CODE = {
  u: CLAIM_STATUS.Unsent,
  h: CLAIM_STATUS.HoldUntilPrimaryReceived,
  w: CLAIM_STATUS.WaitingInQueue,
  i: CLAIM_STATUS.HoldForInProcess,
  s: CLAIM_STATUS.Sent,
  r: CLAIM_STATUS.Received,
} as const;

/**
 * The six documented ClaimStatus codes.
 */
export const OPEN_DENTAL_CLAIM_STATUS_CODES = [
  "U",
  "H",
  "W",
  "I",
  "S",
  "R",
] as const;

export type OpenDentalClaimStatus =
  (typeof OPEN_DENTAL_CLAIM_STATUS_CODES)[number];

export function mapClaimStatus(
  raw: string | null | undefined
): ClaimStatus {
  return (
    CLAIM_STATUS_BY_CODE[
      lookupKey(raw) as keyof typeof CLAIM_STATUS_BY_CODE
    ] ?? CLAIM_STATUS.Unknown
  );
}

/**
 * A claim that exists but has not reached the payer yet.
 *
 * Unknown is excluded: an unrecognized code must never be reported as
 * recoverable revenue, because that would overstate the opportunity.
 */
export function isClaimAwaitingSubmission(
  status: string | null | undefined
): boolean {
  return (
    status === CLAIM_STATUS.Unsent ||
    status === CLAIM_STATUS.HoldUntilPrimaryReceived ||
    status === CLAIM_STATUS.WaitingInQueue ||
    status === CLAIM_STATUS.HoldForInProcess
  );
}

// =========================================
// Treatment plans
// =========================================

/**
 * TPStatus is the one status field Open Dental returns as whole words, so it
 * needs no code translation. It is enumerated here only so callers can rely
 * on a checked type instead of bare string literals.
 */
export const TREAT_PLAN_STATUS = {
  Active: "Active",
  Inactive: "Inactive",
  Saved: "Saved",
} as const;

export type TreatPlanStatus =
  (typeof TREAT_PLAN_STATUS)[keyof typeof TREAT_PLAN_STATUS];

// =========================================
// Recalls
// =========================================

/**
 * Recall status is deliberately absent from this section.
 *
 * Open Dental's RecallStatus is an integer foreign key into the definition
 * table and describes the reminder that was sent ("Mailed Postcard", "Left
 * Msg"), not whether the recall was fulfilled. The API documents it as
 * describing "the recall reminder itself, and not the status of the
 * resulting appointment", so there is no completed value to map. Completion
 * must be derived from dates, which is what isRecallComplete does.
 */
export function isRecallComplete(
  completedDate: string | null | undefined
): boolean {
  return normalizeOpenDentalDate(completedDate) !== null;
}

// =========================================
// Shared helpers
// =========================================

/**
 * Open Dental's empty-date sentinel. Dates are returned as "0001-01-01" and
 * date-times as "0001-01-01 00:00:00" when no value is set, so both must be
 * treated as absent rather than as a real date in year 1.
 */
export const OPEN_DENTAL_EMPTY_DATE = "0001-01-01";

export function normalizeOpenDentalDate(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  return trimmed.startsWith(OPEN_DENTAL_EMPTY_DATE)
    ? null
    : trimmed;
}

/**
 * Captures the untranslated value for the source_status columns, so the
 * normalization above stays reversible and auditable. Accepts numbers
 * because recalls report their status as an integer.
 */
export function normalizeSourceStatus(
  value: string | number | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * Codes are matched case-insensitively. All documented codes remain distinct
 * when lowercased, so this cannot introduce ambiguity, and it stops a casing
 * change from silently collapsing revenue to zero the way a strict match
 * would.
 */
function lookupKey(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) {
    return "";
  }

  return raw.trim().toLowerCase();
}
