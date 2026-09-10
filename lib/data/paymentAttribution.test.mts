import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { mapOpenDentalClaimProc } from "../opendental/claimProc.ts";
import { receivedClaimProc } from "../opendental/claimProc.fixtures.ts";
import {
  ATTRIBUTION_STATUS_ACTIVE,
  ATTRIBUTION_STATUS_REVERSED,
  claimProcMatchesOpportunity,
  creditForEligiblePayment,
  planPracticeAttributions,
  remainingCap,
  sumActiveAttributedAmount,
  type AttributionClaim,
  type AttributionOpportunity,
  type AttributionProcedure,
  type StoredAttribution,
  type StoredClaimProc,
} from "./paymentAttribution.ts";
import { summarizeClaimRecovery } from "./recoveredRevenue.ts";

const PRACTICE_A = "practice-a";
const PRACTICE_B = "practice-b";
const MIGRATION_PATH = fileURLToPath(
  new URL(
    "../../supabase/migrations/20260911010000_claim_payment_attribution.sql",
    import.meta.url
  )
);

function opportunity(
  overrides: Partial<AttributionOpportunity> = {}
): AttributionOpportunity {
  return {
    id: "opp-claim",
    practice_id: PRACTICE_A,
    opportunity_type: "Claim",
    patient_id: "patient-a",
    claim_id: "claim-a",
    procedure_id: "proc-a",
    identified_at: "2021-02-01T00:00:00.000Z",
    identified_estimated_value: 100,
    workflow_status: "open",
    close_reason: null,
    ...overrides,
  };
}

function claim(overrides: Partial<AttributionClaim> = {}): AttributionClaim {
  return {
    id: "claim-a",
    practice_id: PRACTICE_A,
    source_claim_id: "98567",
    amount_paid: 9999,
    paid_at: "1999-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function procedure(
  overrides: Partial<AttributionProcedure> = {}
): AttributionProcedure {
  return {
    id: "proc-a",
    practice_id: PRACTICE_A,
    source_procedure_id: "1734730",
    ...overrides,
  };
}

function storedClaimProc(
  overrides: Partial<StoredClaimProc> = {}
): StoredClaimProc {
  const mapped = mapOpenDentalClaimProc(
    receivedClaimProc({
      DateCP: "2021-02-16",
      InsPayAmt: 78,
    })
  )!;

  return {
    id: "cp-1",
    practice_id: PRACTICE_A,
    ...mapped,
    ...overrides,
  };
}

function plan(input: {
  claimProcs?: StoredClaimProc[];
  opportunities?: AttributionOpportunity[];
  claims?: AttributionClaim[];
  procedures?: AttributionProcedure[];
  existing?: StoredAttribution[];
}) {
  return planPracticeAttributions({
    claimProcs: input.claimProcs ?? [storedClaimProc()],
    opportunities: input.opportunities ?? [opportunity()],
    claims: input.claims ?? [claim()],
    procedures: input.procedures ?? [procedure()],
    existing: input.existing ?? [],
  });
}

describe("attribution matching", () => {
  it("19. ClaimNum + ProcNum exact match works", () => {
    const result = claimProcMatchesOpportunity({
      opportunity: opportunity(),
      claim: claim(),
      procedure: procedure(),
      claimProc: storedClaimProc(),
    });
    assert.equal(result.matches, true);
  });

  it("20. ClaimNum match + conflicting ProcNum does not credit", () => {
    const mutations = plan({
      claimProcs: [storedClaimProc({ source_procedure_id: 999 })],
    });
    assert.equal(mutations.length, 0);
  });

  it("21. ProcNum null is not procedure-guessed", () => {
    const mutations = plan({
      claimProcs: [storedClaimProc({ source_procedure_id: null })],
    });
    assert.equal(mutations.length, 0);
  });

  it("allows claim-level ProcNum null when the opportunity has no procedure_id", () => {
    const mutations = plan({
      opportunities: [opportunity({ procedure_id: null })],
      claimProcs: [storedClaimProc({ source_procedure_id: null })],
    });
    assert.equal(mutations[0]?.kind, "insert");
  });

  it("22. never uses patient + fee matching", () => {
    const mutations = plan({
      claims: [claim({ source_claim_id: "1" })],
      claimProcs: [storedClaimProc({ source_claim_id: 2, ins_pay_amt: 250 })],
    });
    assert.equal(mutations.length, 0);
  });

  it("26. Recall opportunities receive no insurance attribution", () => {
    const mutations = plan({
      opportunities: [opportunity({ opportunity_type: "Recall", claim_id: "claim-a" })],
    });
    assert.equal(mutations.length, 0);
  });

  it("27. Treatment opportunities receive no insurance attribution", () => {
    const mutations = plan({
      opportunities: [
        opportunity({ opportunity_type: "Treatment", claim_id: "claim-a" }),
      ],
    });
    assert.equal(mutations.length, 0);
  });
});

describe("credit calculation", () => {
  it("11. WriteOff is not recovered revenue", () => {
    const mutations = plan({
      claimProcs: [storedClaimProc({ write_off: 40, ins_pay_amt: 78 })],
    });
    assert.equal(mutations[0]?.kind, "insert");
    assert.equal(mutations[0]?.kind === "insert" && mutations[0].creditedAmount, 78);
  });

  it("12-14. only credits DateCP after identified_at", () => {
    assert.equal(
      creditForEligiblePayment({
        insPayAmt: 50,
        remainingCap: 100,
        dateCp: "2021-02-01",
        identifiedAt: "2021-02-01T00:00:00.000Z",
      }),
      0
    );
    assert.equal(
      creditForEligiblePayment({
        insPayAmt: 50,
        remainingCap: 100,
        dateCp: "2021-02-02",
        identifiedAt: "2021-02-01T00:00:00.000Z",
      }),
      50
    );
  });

  it("15. credit is capped at identified_estimated_value", () => {
    const mutations = plan({
      opportunities: [opportunity({ identified_estimated_value: 50 })],
      claimProcs: [storedClaimProc({ ins_pay_amt: 78 })],
    });
    assert.equal(mutations[0]?.kind === "insert" && mutations[0].creditedAmount, 50);
  });

  it("16. two payments partially recover an opportunity", () => {
    const first = storedClaimProc({ id: "cp-1", ins_pay_amt: 40, source_claimproc_id: 1 });
    const second = storedClaimProc({
      id: "cp-2",
      ins_pay_amt: 40,
      source_claimproc_id: 2,
      source_procedure_id: 1734728,
    });
    const mutations = plan({
      opportunities: [opportunity({ procedure_id: null, identified_estimated_value: 60 })],
      claimProcs: [first, second],
    });
    const inserts = mutations.filter((row) => row.kind === "insert");
    assert.equal(inserts.length, 2);
    const total = inserts.reduce(
      (sum, row) => sum + (row.kind === "insert" ? row.creditedAmount : 0),
      0
    );
    assert.equal(total, 60);
  });

  it("17. supplemental payment creates additional credit", () => {
    const original = storedClaimProc({
      id: "cp-1",
      ins_pay_amt: 50,
      source_claimproc_id: 40,
    });
    const supplemental = storedClaimProc({
      id: "cp-2",
      status: "Supplemental",
      ins_pay_amt: 15,
      source_claimproc_id: 214,
    });
    const mutations = plan({
      opportunities: [opportunity({ identified_estimated_value: 100 })],
      claimProcs: [original, supplemental],
    });
    assert.equal(mutations.length, 2);
    assert.equal(
      mutations.every((row) => row.kind === "insert"),
      true
    );
  });

  it("uses remaining cap helper without live estimated_value", () => {
    assert.equal(remainingCap(100, [40, 50]), 10);
    assert.equal(remainingCap(100, [100]), 0);
  });
});

describe("duplicate protection and workflow", () => {
  it("18. same ClaimProc cannot credit two opportunities", () => {
    const mutations = plan({
      opportunities: [
        opportunity({ id: "opp-1", identified_at: "2021-01-01T00:00:00.000Z" }),
        opportunity({ id: "opp-2", identified_at: "2021-01-02T00:00:00.000Z" }),
      ],
    });
    const inserts = mutations.filter((row) => row.kind === "insert");
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0]?.kind === "insert" && inserts[0].opportunityId, "opp-1");
  });

  it("23. dismissed opportunity receives no new credit", () => {
    const mutations = plan({
      opportunities: [
        opportunity({
          workflow_status: "dismissed",
          close_reason: "office_dismissed",
        }),
      ],
    });
    assert.equal(mutations.length, 0);
  });

  it("24. office-completed opportunity can receive later valid credit", () => {
    const mutations = plan({
      opportunities: [
        opportunity({
          workflow_status: "completed",
          close_reason: "office_completed",
        }),
      ],
    });
    assert.equal(mutations[0]?.kind, "insert");
  });

  it("25. scanner-closed opportunity can receive later valid credit", () => {
    const mutations = plan({
      opportunities: [
        opportunity({
          workflow_status: "completed",
          close_reason: "scanner_closed",
        }),
      ],
    });
    assert.equal(mutations[0]?.kind, "insert");
  });

  it("28. Claim + Treatment for the same patient does not double-credit", () => {
    const mutations = plan({
      opportunities: [
        opportunity({ id: "opp-claim" }),
        opportunity({
          id: "opp-tx",
          opportunity_type: "Treatment",
          claim_id: "claim-a",
          procedure_id: "proc-a",
        }),
      ],
    });
    assert.equal(mutations.length, 1);
    assert.equal(
      mutations[0]?.kind === "insert" && mutations[0].opportunityId,
      "opp-claim"
    );
  });
});

describe("mutable ClaimProc recalculation", () => {
  const existing: StoredAttribution = {
    id: "attr-1",
    practice_id: PRACTICE_A,
    opportunity_id: "opp-claim",
    claimproc_id: "cp-1",
    source_claimproc_id: 1984257,
    credited_amount: 78,
    payment_dated_at: "2021-02-16",
    identified_at_snapshot: "2021-02-01T00:00:00.000Z",
    cap_snapshot: 100,
    status: ATTRIBUTION_STATUS_ACTIVE,
  };

  it("29. InsPayAmt mutation recalculates credit", () => {
    const mutations = plan({
      claimProcs: [storedClaimProc({ ins_pay_amt: 40 })],
      existing: [existing],
    });
    assert.equal(mutations[0]?.kind, "adjust");
    assert.equal(
      mutations[0]?.kind === "adjust" && mutations[0].creditedAmount,
      40
    );
  });

  it("30. ClaimProc becoming non-paid reverses credit", () => {
    const mutations = plan({
      claimProcs: [storedClaimProc({ status: "Estimate" })],
      existing: [existing],
    });
    assert.equal(mutations[0]?.kind, "reverse");
  });

  it("31. ClaimProc deletion reverses credit", () => {
    const mutations = plan({
      claimProcs: [],
      existing: [existing],
    });
    assert.equal(mutations[0]?.kind, "reverse");
    assert.equal(
      mutations[0]?.kind === "reverse" && mutations[0].reason,
      "claimproc_deleted_or_absent"
    );
  });

  it("32. DateCP change recalculates attribution", () => {
    const mutations = plan({
      claimProcs: [storedClaimProc({ date_cp: "2021-03-01" })],
      existing: [existing],
    });
    assert.equal(mutations[0]?.kind, "adjust");
    assert.equal(
      mutations[0]?.kind === "adjust" && mutations[0].paymentDatedAt,
      "2021-03-01"
    );
  });

  it("keeps dismissed credits and does not add new ones", () => {
    const mutations = plan({
      opportunities: [
        opportunity({
          workflow_status: "dismissed",
          close_reason: "office_dismissed",
        }),
      ],
      existing: [existing],
    });
    assert.equal(mutations.length, 0);
  });
});

describe("dashboard recovered revenue isolation", () => {
  it("33. tenant isolation: practice B rows are not summed for A", () => {
    const total = sumActiveAttributedAmount(
      [
        {
          practice_id: PRACTICE_A,
          credited_amount: 10,
          status: ATTRIBUTION_STATUS_ACTIVE,
        },
        {
          practice_id: PRACTICE_B,
          credited_amount: 90,
          status: ATTRIBUTION_STATUS_ACTIVE,
        },
      ],
      PRACTICE_A
    );
    assert.equal(total, 10);
  });

  it("38. recovered revenue sums only active ledger rows", () => {
    const total = sumActiveAttributedAmount(
      [
        {
          practice_id: PRACTICE_A,
          credited_amount: 25,
          status: ATTRIBUTION_STATUS_ACTIVE,
        },
        {
          practice_id: PRACTICE_A,
          credited_amount: 25,
          status: ATTRIBUTION_STATUS_REVERSED,
        },
      ],
      PRACTICE_A
    );
    assert.equal(total, 25);
  });

  it("39-42. header paid_at, WriteOff, scanner_closed, and office complete are not recovered", () => {
    const mutations = plan({
      claims: [claim({ amount_paid: 500, paid_at: "2021-02-16T00:00:00.000Z" })],
      opportunities: [
        opportunity({
          close_reason: "scanner_closed",
          workflow_status: "completed",
        }),
      ],
      claimProcs: [storedClaimProc({ write_off: 88, ins_pay_amt: 10 })],
    });
    assert.equal(mutations[0]?.kind === "insert" && mutations[0].creditedAmount, 10);

    const recovery = summarizeClaimRecovery({
      opportunityId: "opp-claim",
      identifiedEstimatedValue: 100,
      creditedAmount: 0,
      paymentPostedOn: null,
    });
    assert.equal(recovery.creditedAmount, 0);
    assert.equal(recovery.state, "none");
  });
});

describe("migration security", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("34-37. authenticated can select but cannot mutate ClaimProc or attribution", () => {
    assert.match(
      sql,
      /grant select on table public.opendental_claimprocs to authenticated/
    );
    assert.match(
      sql,
      /grant select on table public.opportunity_payment_attributions to authenticated/
    );
    assert.doesNotMatch(
      sql,
      /grant (insert|update|delete).*opendental_claimprocs to authenticated/
    );
    assert.doesNotMatch(
      sql,
      /grant (insert|update|delete).*opportunity_payment_attributions to authenticated/
    );
    assert.match(
      sql,
      /grant select, insert, update on table public.opendental_claimprocs to service_role/
    );
    assert.match(sql, /user_practice_ids\(\)/);
    assert.match(
      sql,
      /create unique index if not exists opportunity_payment_attributions_one_active_claimproc/
    );
    assert.match(sql, /date_cp date/);
    assert.match(sql, /There is no paid_at column/);
    assert.match(sql, /date_cp date/);
  });
});
