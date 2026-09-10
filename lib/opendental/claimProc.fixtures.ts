import type { OpenDentalClaimProc } from "./claimProc.ts";

/**
 * Documented GET /claimprocs example from
 * https://www.opendental.com/site/apiclaimprocs.html
 * Patient identifiers are the published API sample, not a real office.
 */
export const OFFICIAL_RECEIVED_CLAIMPROC: OpenDentalClaimProc = {
  ClaimProcNum: 1984257,
  ProcNum: 1734730,
  ClaimNum: 98567,
  PatNum: 1337,
  FeeBilled: 88.0,
  InsPayEst: 88.0,
  DedApplied: 10.0,
  Status: "Received",
  InsPayAmt: 78.0,
  ClaimPaymentNum: 6352,
  DateCP: "2021-02-16",
  WriteOff: 0.0,
  CopayAmt: -1.0,
  ProcDate: "2021-02-16",
  DateEntry: "0001-01-01",
  IsTransfer: "false",
  IsOverpay: "false",
  ClaimAdjReasonCodes: "",
};

export const OFFICIAL_RECEIVED_CLAIMPROC_SECOND: OpenDentalClaimProc = {
  ClaimProcNum: 1984258,
  ProcNum: 1734728,
  ClaimNum: 98567,
  PatNum: 1337,
  FeeBilled: 76.0,
  InsPayEst: 76.0,
  DedApplied: 0.0,
  Status: "Received",
  InsPayAmt: 76.0,
  ClaimPaymentNum: 6352,
  DateCP: "2021-02-16",
  WriteOff: 0.0,
  CopayAmt: -1.0,
  ProcDate: "2021-02-16",
  DateEntry: "0001-01-01",
  IsTransfer: "false",
  IsOverpay: "false",
};

export const OFFICIAL_ADJUSTMENT_CLAIMPROC: OpenDentalClaimProc = {
  ClaimProcNum: 1117,
  ProcNum: 0,
  ClaimNum: 0,
  PatNum: 72,
  Status: "Adjustment",
  InsPayAmt: 300.75,
  ClaimPaymentNum: 0,
  DateCP: "0001-01-01",
  WriteOff: 0.0,
  DedApplied: 25.99,
  ProcDate: "2023-07-18",
  DateEntry: "0001-01-01",
  IsTransfer: "false",
  IsOverpay: "false",
};

export const OFFICIAL_SUPPLEMENTAL_CLAIMPROC: OpenDentalClaimProc = {
  ClaimProcNum: 214,
  ProcNum: 35,
  ClaimNum: 7,
  PatNum: 11,
  Status: "Supplemental",
  InsPayAmt: 15.0,
  ClaimPaymentNum: 0,
  DateCP: "2025-04-24",
  WriteOff: 0.0,
  ProcDate: "2023-11-05",
  DateEntry: "2025-04-24",
  IsTransfer: "false",
  IsOverpay: "false",
};

export function receivedClaimProc(
  overrides: Partial<OpenDentalClaimProc> = {}
): OpenDentalClaimProc {
  return {
    ...OFFICIAL_RECEIVED_CLAIMPROC,
    ...overrides,
  };
}
