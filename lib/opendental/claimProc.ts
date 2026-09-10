import { normalizeOpenDentalDate } from "./status.ts";

/**
 * Open Dental ClaimProc fields documented on
 * https://www.opendental.com/site/apiclaimprocs.html
 * and the ClaimProc schema. DateCP is the PMS
 * payment-report date, not a bank or check-issued date.
 */
export type OpenDentalClaimProc = {
  ClaimProcNum: number;
  ClaimNum?: number;
  PatNum?: number;
  ProcNum?: number;
  InsPayEst?: number;
  InsPayAmt?: number;
  Status?: string;
  WriteOff?: number;
  ClaimPaymentNum?: number;
  DateCP?: string;
  DateEntry?: string;
  ProcDate?: string;
  FeeBilled?: number;
  DedApplied?: number;
  CopayAmt?: number;
  IsTransfer?: boolean | string;
  IsOverpay?: boolean | string;
  ClaimAdjReasonCodes?: string;
};

export const DATE_CP_FIELD = "date_cp" as const;

export const DATE_CP_INTERNAL_LABEL =
  "Open Dental PMS payment-report date" as const;

export const DATE_CP_UI_LABEL = "Payment posted in Open Dental" as const;

export const ATTRIBUTABLE_CLAIMPROC_STATUSES = [
  "Received",
  "Supplemental",
] as const;

export type AttributableClaimProcStatus =
  (typeof ATTRIBUTABLE_CLAIMPROC_STATUSES)[number];

export const NON_ATTRIBUTABLE_CLAIMPROC_STATUSES = [
  "Estimate",
  "NotReceived",
  "Preauth",
  "Adjustment",
  "CapClaim",
  "CapComplete",
  "CapEstimate",
  "InsHist",
] as const;

export type MappedClaimProc = {
  source_claimproc_id: number;
  source_claim_id: number | null;
  source_procedure_id: number | null;
  source_patient_id: number | null;
  ins_pay_amt: number;
  ins_pay_est: number;
  status: string;
  write_off: number;
  claim_payment_num: number | null;
  date_cp: string | null;
  date_entry: string | null;
  proc_date: string | null;
  fee_billed: number | null;
  ded_applied: number | null;
  copay_amt: number | null;
  is_transfer: boolean | null;
  is_overpay: boolean | null;
  claim_adj_reason_codes: string | null;
};

export function openDentalKeyToNull(
  value: number | string | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric === 0) {
    return null;
  }

  return numeric;
}

export function parseOpenDentalBoolean(
  value: boolean | string | null | undefined
): boolean | null {
  if (value === true || value === false) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return null;
}

function optionalNumber(
  value: number | string | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function money(value: number | string | null | undefined): number {
  const numeric = optionalNumber(value);
  return numeric ?? 0;
}

function dateOnly(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function mapOpenDentalClaimProc(
  payload: OpenDentalClaimProc
): MappedClaimProc | null {
  const sourceClaimProcId = openDentalKeyToNull(payload.ClaimProcNum);

  if (sourceClaimProcId === null) {
    return null;
  }

  return {
    source_claimproc_id: sourceClaimProcId,
    source_claim_id: openDentalKeyToNull(payload.ClaimNum),
    source_procedure_id: openDentalKeyToNull(payload.ProcNum),
    source_patient_id: openDentalKeyToNull(payload.PatNum),
    ins_pay_amt: money(payload.InsPayAmt),
    ins_pay_est: money(payload.InsPayEst),
    status: String(payload.Status ?? "").trim(),
    write_off: money(payload.WriteOff),
    claim_payment_num: openDentalKeyToNull(payload.ClaimPaymentNum),
    date_cp: dateOnly(normalizeOpenDentalDate(payload.DateCP)),
    date_entry: dateOnly(normalizeOpenDentalDate(payload.DateEntry)),
    proc_date: dateOnly(normalizeOpenDentalDate(payload.ProcDate)),
    fee_billed: optionalNumber(payload.FeeBilled),
    ded_applied: optionalNumber(payload.DedApplied),
    copay_amt: optionalNumber(payload.CopayAmt),
    is_transfer: parseOpenDentalBoolean(payload.IsTransfer),
    is_overpay: parseOpenDentalBoolean(payload.IsOverpay),
    claim_adj_reason_codes: payload.ClaimAdjReasonCodes?.trim()
      ? payload.ClaimAdjReasonCodes.trim()
      : null,
  };
}

export function isAttributableClaimProcStatus(
  status: string | null | undefined
): status is AttributableClaimProcStatus {
  return (
    status === "Received" || status === "Supplemental"
  );
}

export type ClaimProcEligibility = {
  eligible: boolean;
  reasons: string[];
};

export function evaluateClaimProcEligibility(
  row: Pick<
    MappedClaimProc,
    | "status"
    | "claim_payment_num"
    | "ins_pay_amt"
    | "source_claim_id"
    | "date_cp"
    | "is_transfer"
  > & {
    absent_from_sync_at?: string | null;
  }
): ClaimProcEligibility {
  const reasons: string[] = [];

  if (row.absent_from_sync_at) {
    reasons.push("absent_from_sync");
  }

  if (!isAttributableClaimProcStatus(row.status)) {
    reasons.push("status_not_received_or_supplemental");
  }

  if (row.claim_payment_num === null) {
    reasons.push("claim_payment_num_missing");
  }

  if (!(Number(row.ins_pay_amt) > 0)) {
    reasons.push("ins_pay_amt_not_positive");
  }

  if (row.source_claim_id === null) {
    reasons.push("claim_num_missing");
  }

  if (!row.date_cp) {
    reasons.push("date_cp_missing");
  }

  if (row.is_transfer === true) {
    reasons.push("is_transfer");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

/**
 * DateCP is a calendar date. identified_at is a timestamptz.
 * Credit only when DateCP as UTC midnight is strictly after identified_at.
 * Same calendar instant or earlier is not credited.
 */
export function isPaymentDateAfterIdentification(
  dateCp: string | null | undefined,
  identifiedAt: string | null | undefined
): boolean {
  if (!dateCp || !identifiedAt) {
    return false;
  }

  const paymentMs = Date.parse(`${dateCp}T00:00:00.000Z`);
  const identifiedMs = Date.parse(identifiedAt);

  if (Number.isNaN(paymentMs) || Number.isNaN(identifiedMs)) {
    return false;
  }

  return paymentMs > identifiedMs;
}

export function sourceIdKey(
  value: string | number | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const trimmed = String(value).trim();

  if (trimmed === "" || trimmed === "0") {
    return null;
  }

  const numeric = Number(trimmed);

  if (Number.isFinite(numeric)) {
    return String(numeric);
  }

  return trimmed;
}
