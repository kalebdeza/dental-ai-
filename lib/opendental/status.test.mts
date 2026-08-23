import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CLAIM_STATUS,
  isBillableCompletedProcedure,
  isClaimAwaitingSubmission,
  isOutstandingPlannedTreatment,
  isRecallComplete,
  mapClaimStatus,
  mapProcedureStatus,
  normalizeOpenDentalDate,
  normalizeSourceStatus,
  OPEN_DENTAL_CLAIM_STATUS_CODES,
  OPEN_DENTAL_PROC_STATUS_CODES,
  PROCEDURE_STATUS,
} from "./status.ts";

// =========================================
// Procedure status
// =========================================

test("maps every documented ProcStatus code", () => {
  assert.equal(mapProcedureStatus("C"), PROCEDURE_STATUS.Completed);
  assert.equal(
    mapProcedureStatus("TP"),
    PROCEDURE_STATUS.TreatmentPlanned
  );
  assert.equal(
    mapProcedureStatus("TPi"),
    PROCEDURE_STATUS.TreatmentPlannedInactive
  );
  assert.equal(
    mapProcedureStatus("EC"),
    PROCEDURE_STATUS.ExistingCurrentProvider
  );
  assert.equal(
    mapProcedureStatus("EO"),
    PROCEDURE_STATUS.ExistingOtherProvider
  );
  assert.equal(mapProcedureStatus("R"), PROCEDURE_STATUS.ReferredOut);
  assert.equal(mapProcedureStatus("D"), PROCEDURE_STATUS.Deleted);
  assert.equal(mapProcedureStatus("Cn"), PROCEDURE_STATUS.Condition);
});

test("no documented ProcStatus code falls through to Unknown", () => {
  for (const code of OPEN_DENTAL_PROC_STATUS_CODES) {
    assert.notEqual(
      mapProcedureStatus(code),
      PROCEDURE_STATUS.Unknown,
      `${code} should map to a known status`
    );
  }
});

test("ProcStatus mapping tolerates casing and whitespace", () => {
  assert.equal(mapProcedureStatus(" c "), PROCEDURE_STATUS.Completed);
  assert.equal(
    mapProcedureStatus("tpi"),
    PROCEDURE_STATUS.TreatmentPlannedInactive
  );
  assert.equal(mapProcedureStatus("CN"), PROCEDURE_STATUS.Condition);
});

test("unrecognized or absent ProcStatus becomes Unknown", () => {
  assert.equal(mapProcedureStatus("X"), PROCEDURE_STATUS.Unknown);
  assert.equal(
    mapProcedureStatus("Completed"),
    PROCEDURE_STATUS.Unknown
  );
  assert.equal(mapProcedureStatus(""), PROCEDURE_STATUS.Unknown);
  assert.equal(mapProcedureStatus(null), PROCEDURE_STATUS.Unknown);
  assert.equal(
    mapProcedureStatus(undefined),
    PROCEDURE_STATUS.Unknown
  );
});

test("only Completed procedures are billable", () => {
  assert.equal(
    isBillableCompletedProcedure(PROCEDURE_STATUS.Completed),
    true
  );

  for (const status of Object.values(PROCEDURE_STATUS)) {
    if (status === PROCEDURE_STATUS.Completed) {
      continue;
    }

    assert.equal(
      isBillableCompletedProcedure(status),
      false,
      `${status} must not be billable`
    );
  }
});

test("existing-provider procedures are never billable", () => {
  assert.equal(
    isBillableCompletedProcedure(mapProcedureStatus("EC")),
    false
  );
  assert.equal(
    isBillableCompletedProcedure(mapProcedureStatus("EO")),
    false
  );
});

test("only TreatmentPlanned is outstanding treatment", () => {
  assert.equal(
    isOutstandingPlannedTreatment(PROCEDURE_STATUS.TreatmentPlanned),
    true
  );

  for (const status of Object.values(PROCEDURE_STATUS)) {
    if (status === PROCEDURE_STATUS.TreatmentPlanned) {
      continue;
    }

    assert.equal(
      isOutstandingPlannedTreatment(status),
      false,
      `${status} must not count as outstanding treatment`
    );
  }
});

// =========================================
// Claim status
// =========================================

test("maps every documented ClaimStatus code", () => {
  assert.equal(mapClaimStatus("U"), CLAIM_STATUS.Unsent);
  assert.equal(
    mapClaimStatus("H"),
    CLAIM_STATUS.HoldUntilPrimaryReceived
  );
  assert.equal(mapClaimStatus("W"), CLAIM_STATUS.WaitingInQueue);
  assert.equal(mapClaimStatus("I"), CLAIM_STATUS.HoldForInProcess);
  assert.equal(mapClaimStatus("S"), CLAIM_STATUS.Sent);
  assert.equal(mapClaimStatus("R"), CLAIM_STATUS.Received);
});

test("no documented ClaimStatus code falls through to Unknown", () => {
  for (const code of OPEN_DENTAL_CLAIM_STATUS_CODES) {
    assert.notEqual(
      mapClaimStatus(code),
      CLAIM_STATUS.Unknown,
      `${code} should map to a known status`
    );
  }
});

test("unrecognized or absent ClaimStatus becomes Unknown", () => {
  assert.equal(mapClaimStatus("Z"), CLAIM_STATUS.Unknown);
  assert.equal(
    mapClaimStatus("Not Submitted"),
    CLAIM_STATUS.Unknown
  );
  assert.equal(mapClaimStatus(""), CLAIM_STATUS.Unknown);
  assert.equal(mapClaimStatus(null), CLAIM_STATUS.Unknown);
  assert.equal(mapClaimStatus(undefined), CLAIM_STATUS.Unknown);
});

test("claims awaiting submission are the four pre-payer states", () => {
  assert.equal(isClaimAwaitingSubmission(CLAIM_STATUS.Unsent), true);
  assert.equal(
    isClaimAwaitingSubmission(CLAIM_STATUS.HoldUntilPrimaryReceived),
    true
  );
  assert.equal(
    isClaimAwaitingSubmission(CLAIM_STATUS.WaitingInQueue),
    true
  );
  assert.equal(
    isClaimAwaitingSubmission(CLAIM_STATUS.HoldForInProcess),
    true
  );

  assert.equal(isClaimAwaitingSubmission(CLAIM_STATUS.Sent), false);
  assert.equal(
    isClaimAwaitingSubmission(CLAIM_STATUS.Received),
    false
  );
  assert.equal(
    isClaimAwaitingSubmission(CLAIM_STATUS.Unknown),
    false
  );
});

// =========================================
// Date sentinels
// =========================================

test("normalizes the empty-date sentinel to null", () => {
  assert.equal(normalizeOpenDentalDate("0001-01-01"), null);
  assert.equal(
    normalizeOpenDentalDate("0001-01-01 00:00:00"),
    null
  );
  assert.equal(normalizeOpenDentalDate(" 0001-01-01 "), null);
});

test("preserves real dates", () => {
  assert.equal(
    normalizeOpenDentalDate("2022-05-05"),
    "2022-05-05"
  );
  assert.equal(
    normalizeOpenDentalDate("2022-05-05 07:00:34"),
    "2022-05-05 07:00:34"
  );
});

test("treats blank and absent dates as null", () => {
  assert.equal(normalizeOpenDentalDate(""), null);
  assert.equal(normalizeOpenDentalDate("   "), null);
  assert.equal(normalizeOpenDentalDate(null), null);
  assert.equal(normalizeOpenDentalDate(undefined), null);
});

// =========================================
// Recall completion
// =========================================

test("recall completion is derived from dates, not status", () => {
  assert.equal(isRecallComplete("2023-03-07"), true);
  assert.equal(isRecallComplete("0001-01-01"), false);
  assert.equal(isRecallComplete(""), false);
  assert.equal(isRecallComplete(null), false);
  assert.equal(isRecallComplete(undefined), false);
});

// =========================================
// Raw status capture
// =========================================

test("captures raw status values, including numeric recall codes", () => {
  assert.equal(normalizeSourceStatus("C"), "C");
  assert.equal(normalizeSourceStatus(142), "142");
  assert.equal(normalizeSourceStatus(0), "0");
  assert.equal(normalizeSourceStatus(" TP "), "TP");
  assert.equal(normalizeSourceStatus(""), null);
  assert.equal(normalizeSourceStatus("   "), null);
  assert.equal(normalizeSourceStatus(null), null);
  assert.equal(normalizeSourceStatus(undefined), null);
});
