import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DATE_CP_FIELD,
  evaluateClaimProcEligibility,
  isPaymentDateAfterIdentification,
  mapOpenDentalClaimProc,
  openDentalKeyToNull,
} from "./claimProc.ts";
import {
  OFFICIAL_ADJUSTMENT_CLAIMPROC,
  OFFICIAL_RECEIVED_CLAIMPROC,
  OFFICIAL_SUPPLEMENTAL_CLAIMPROC,
  receivedClaimProc,
} from "./claimProc.fixtures.ts";

describe("ClaimProc mapper", () => {
  it("maps the official Received example and never names DateCP paid_at", () => {
    const row = mapOpenDentalClaimProc(OFFICIAL_RECEIVED_CLAIMPROC);

    assert.equal(row?.source_claimproc_id, 1984257);
    assert.equal(row?.source_claim_id, 98567);
    assert.equal(row?.source_procedure_id, 1734730);
    assert.equal(row?.ins_pay_amt, 78);
    assert.equal(row?.status, "Received");
    assert.equal(row?.claim_payment_num, 6352);
    assert.equal(row?.date_cp, "2021-02-16");
    assert.equal(row?.date_entry, null);
    assert.equal(row?.is_transfer, false);
    assert.equal(DATE_CP_FIELD, "date_cp");
    assert.equal(Object.hasOwn(row ?? {}, "paid_at"), false);
  });

  it("turns ClaimNum 0, ProcNum 0, ClaimPaymentNum 0, and 0001-01-01 into null", () => {
    const row = mapOpenDentalClaimProc(OFFICIAL_ADJUSTMENT_CLAIMPROC);

    assert.equal(row?.source_claim_id, null);
    assert.equal(row?.source_procedure_id, null);
    assert.equal(row?.claim_payment_num, null);
    assert.equal(row?.date_cp, null);
    assert.equal(openDentalKeyToNull(0), null);
  });

  it("maps the official Supplemental example", () => {
    const row = mapOpenDentalClaimProc(OFFICIAL_SUPPLEMENTAL_CLAIMPROC);

    assert.equal(row?.status, "Supplemental");
    assert.equal(row?.ins_pay_amt, 15);
    assert.equal(row?.date_cp, "2025-04-24");
    assert.equal(row?.claim_payment_num, null);
  });
});

describe("ClaimProc eligibility", () => {
  it("1. Received + ClaimPaymentNum + DateCP is eligible", () => {
    const mapped = mapOpenDentalClaimProc(OFFICIAL_RECEIVED_CLAIMPROC);
    assert.equal(evaluateClaimProcEligibility(mapped!).eligible, true);
  });

  it("2. Supplemental + ClaimPaymentNum + DateCP is eligible", () => {
    const mapped = mapOpenDentalClaimProc(
      receivedClaimProc({
        Status: "Supplemental",
        ClaimProcNum: 214,
        ClaimPaymentNum: 99,
        DateCP: "2025-04-24",
        InsPayAmt: 15,
      })
    );
    assert.equal(evaluateClaimProcEligibility(mapped!).eligible, true);
  });

  it("3. Estimate is not eligible", () => {
    const mapped = mapOpenDentalClaimProc(
      receivedClaimProc({ Status: "Estimate" })
    );
    assert.equal(evaluateClaimProcEligibility(mapped!).eligible, false);
  });

  it("4. Adjustment is not eligible", () => {
    const mapped = mapOpenDentalClaimProc(OFFICIAL_ADJUSTMENT_CLAIMPROC);
    assert.equal(evaluateClaimProcEligibility(mapped!).eligible, false);
  });

  it("5. NotReceived is not eligible", () => {
    const mapped = mapOpenDentalClaimProc(
      receivedClaimProc({ Status: "NotReceived" })
    );
    assert.equal(evaluateClaimProcEligibility(mapped!).eligible, false);
  });

  it("6. ClaimPaymentNum null is not eligible", () => {
    const mapped = mapOpenDentalClaimProc(
      receivedClaimProc({ ClaimPaymentNum: 0 })
    );
    assert.equal(evaluateClaimProcEligibility(mapped!).eligible, false);
  });

  it("7. DateCP null is not eligible", () => {
    const mapped = mapOpenDentalClaimProc(receivedClaimProc({ DateCP: "" }));
    assert.equal(evaluateClaimProcEligibility(mapped!).eligible, false);
  });

  it("8. DateCP 0001-01-01 is not eligible", () => {
    const mapped = mapOpenDentalClaimProc(
      receivedClaimProc({ DateCP: "0001-01-01" })
    );
    assert.equal(mapped?.date_cp, null);
    assert.equal(evaluateClaimProcEligibility(mapped!).eligible, false);
  });

  it("9. InsPayAmt 0 is not eligible", () => {
    const mapped = mapOpenDentalClaimProc(
      receivedClaimProc({ InsPayAmt: 0 })
    );
    assert.equal(evaluateClaimProcEligibility(mapped!).eligible, false);
  });

  it("10. InsPayAmt > 0 can be eligible", () => {
    const mapped = mapOpenDentalClaimProc(
      receivedClaimProc({ InsPayAmt: 1 })
    );
    assert.equal(evaluateClaimProcEligibility(mapped!).eligible, true);
  });

  it("rejects transfers, cap statuses, and Preauth", () => {
    for (const status of [
      "Preauth",
      "CapClaim",
      "CapComplete",
      "CapEstimate",
      "InsHist",
    ]) {
      const mapped = mapOpenDentalClaimProc(receivedClaimProc({ Status: status }));
      assert.equal(evaluateClaimProcEligibility(mapped!).eligible, false, status);
    }

    const transfer = mapOpenDentalClaimProc(
      receivedClaimProc({ IsTransfer: "true" })
    );
    assert.equal(evaluateClaimProcEligibility(transfer!).eligible, false);
  });
});

describe("payment date vs identified_at", () => {
  it("12. payment date before identified_at is not after", () => {
    assert.equal(
      isPaymentDateAfterIdentification("2021-02-15", "2021-02-16T00:00:00.000Z"),
      false
    );
  });

  it("13. payment date equal to identified_at is not after", () => {
    assert.equal(
      isPaymentDateAfterIdentification("2021-02-16", "2021-02-16T00:00:00.000Z"),
      false
    );
  });

  it("14. payment date after identified_at is after", () => {
    assert.equal(
      isPaymentDateAfterIdentification("2021-02-17", "2021-02-16T00:00:00.000Z"),
      true
    );
  });
});
