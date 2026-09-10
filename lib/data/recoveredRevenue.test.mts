import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMemorySupabase } from "../cron/mockSchedulerDb.ts";
import { ATTRIBUTION_STATUS_ACTIVE } from "./paymentAttribution.ts";
import {
  applyAttributionMutations,
  loadPracticeRecoveredRevenue,
  summarizeClaimRecovery,
} from "./recoveredRevenue.ts";

const PRACTICE_A = "practice-a";
const PRACTICE_B = "practice-b";

describe("recovered revenue loader", () => {
  it("sums only this practice's active attribution rows", async () => {
    const memory = createMemorySupabase({
      opportunity_payment_attributions: [
        {
          id: "a1",
          practice_id: PRACTICE_A,
          opportunity_id: "opp-1",
          claimproc_id: "cp-1",
          source_claimproc_id: 1,
          credited_amount: 40,
          payment_dated_at: "2021-02-16",
          identified_at_snapshot: "2021-02-01T00:00:00.000Z",
          cap_snapshot: 100,
          status: ATTRIBUTION_STATUS_ACTIVE,
        },
        {
          id: "a2",
          practice_id: PRACTICE_B,
          opportunity_id: "opp-2",
          claimproc_id: "cp-2",
          source_claimproc_id: 2,
          credited_amount: 80,
          payment_dated_at: "2021-02-16",
          identified_at_snapshot: "2021-02-01T00:00:00.000Z",
          cap_snapshot: 100,
          status: ATTRIBUTION_STATUS_ACTIVE,
        },
      ],
      revenue_opportunities: [
        {
          id: "opp-1",
          practice_id: PRACTICE_A,
          claim_id: "claim-1",
          patient_id: "patient-1",
          identified_estimated_value: 100,
        },
      ],
      claims: [
        {
          id: "claim-1",
          practice_id: PRACTICE_A,
          claim_number: "98567",
          amount_paid: 500,
          paid_at: "2021-02-16T00:00:00.000Z",
        },
      ],
      patients: [
        {
          id: "patient-1",
          practice_id: PRACTICE_A,
          first_name: "Ada",
          last_name: "Lovelace",
        },
      ],
    });

    const result = await loadPracticeRecoveredRevenue(
      memory.supabase as never,
      PRACTICE_A
    );

    assert.equal(result.recoveredRevenue, 40);
    assert.equal(result.details.length, 1);
    assert.equal(result.details[0]?.patientName, "Ada Lovelace");
    assert.equal(result.details[0]?.creditedAmount, 40);
  });

  it("returns $0 when there is no valid attribution, even if claims.amount_paid is set", async () => {
    const memory = createMemorySupabase({
      claims: [
        {
          id: "claim-1",
          practice_id: PRACTICE_A,
          amount_paid: 250,
          paid_at: "2021-02-16T00:00:00.000Z",
        },
      ],
    });

    const result = await loadPracticeRecoveredRevenue(
      memory.supabase as never,
      PRACTICE_A
    );

    assert.equal(result.recoveredRevenue, 0);
    assert.deepEqual(result.details, []);
  });

  it("writes credit and reverse events without deleting the attribution row", async () => {
    const memory = createMemorySupabase({
      opportunity_payment_attributions: [
        {
          id: "attr-1",
          practice_id: PRACTICE_A,
          opportunity_id: "opp-1",
          claimproc_id: "cp-1",
          source_claimproc_id: 1,
          credited_amount: 78,
          payment_dated_at: "2021-02-16",
          identified_at_snapshot: "2021-02-01T00:00:00.000Z",
          cap_snapshot: 100,
          status: ATTRIBUTION_STATUS_ACTIVE,
        },
      ],
    });

    await applyAttributionMutations(
      { supabase: memory.supabase as never, practiceId: PRACTICE_A },
      [
        {
          kind: "reverse",
          attributionId: "attr-1",
          opportunityId: "opp-1",
          claimprocId: "cp-1",
          sourceClaimProcId: 1,
          previousCreditedAmount: 78,
          reason: "claimproc_no_longer_eligible",
        },
      ],
      "2026-09-11T00:00:00.000Z"
    );

    const remaining = memory.tables.opportunity_payment_attributions;
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]?.status, "reversed");
    assert.equal(remaining[0]?.credited_amount, 0);
    assert.equal(memory.tables.opportunity_payment_attribution_events.length, 1);
    assert.equal(
      memory.tables.opportunity_payment_attribution_events[0]?.event_type,
      "reverse"
    );
  });
});

describe("recovery labels", () => {
  it("describes partial vs recovered without claiming Dental AI caused payment", () => {
    const partial = summarizeClaimRecovery({
      opportunityId: "opp",
      identifiedEstimatedValue: 100,
      creditedAmount: 40,
      paymentPostedOn: "2021-02-16",
    });
    assert.equal(partial.state, "partial");
    assert.match(partial.disclaimer, /attributed/);
    assert.doesNotMatch(partial.disclaimer, /caused/i);

    const recovered = summarizeClaimRecovery({
      opportunityId: "opp",
      identifiedEstimatedValue: 100,
      creditedAmount: 100,
      paymentPostedOn: "2021-02-16",
    });
    assert.equal(recovered.state, "recovered");
  });
});
