import type { Tables } from "../database.types.ts";
import { CLAIM_STATUS } from "../opendental/status.ts";
import {
  NOT_AVAILABLE_IN_APP,
  formatClaimAmount,
  formatClaimDate,
  formatPatientName,
  formatProviderName,
} from "./claimDisplay.ts";
import {
  getClaimWorkflowBucket,
  isClaimAging,
  type ClaimOpportunitySummary,
  type ClaimWorkflowBucket,
} from "./claimWorkflow.ts";
import type { ClaimRecoverySummary } from "./recoveredRevenue.ts";

type Claim = Tables<"claims">;
type Patient = Tables<"patients">;
type Provider = Tables<"providers">;

export type ClaimFieldStatus = "available" | "missing" | "not_stored";

export type ClaimFieldCheck = {
  key: string;
  label: string;
  status: ClaimFieldStatus;
  value: string;
};

export type ClaimReadinessState =
  | "ready_based_on_available_data"
  | "needs_review"
  | "insufficient_data";

export type ClaimAssistantInput = {
  claim: Claim;
  patient?: Patient | null;
  provider?: Provider | null;
  opportunity?: ClaimOpportunitySummary | null;
  recovery?: ClaimRecoverySummary | null;
  now?: Date;
};

export type ClaimAssistantView = {
  bucket: ClaimWorkflowBucket;
  title: string;
  recommendedNextStep: string;
  why: string;
  facts: { label: string; value: string }[];
  fields: ClaimFieldCheck[];
  readiness: {
    state: ClaimReadinessState;
    label: string;
  } | null;
  followUpChecklist: string[] | null;
  denialReason: string | null;
  denialUnavailable: boolean;
  denialExplanation: string | null;
  isSyntheticTestData: boolean;
  syntheticNotice: string | null;
  disclaimer: string | null;
};

export const CLAIM_READINESS_DISCLAIMER =
  "Readiness is based only on information currently available in Dental AI. Final claim validation and submission must be completed in your PMS.";

export const CLAIM_SUBMIT_IN_PMS_GUIDANCE =
  "Submit this claim in your PMS. This app does not submit claims to payers or complete insurance validation.";

export const CLAIM_FIX_IN_PMS_GUIDANCE =
  "Fix this claim in your PMS. The app doesn't currently edit insurance claims.";

export const CLAIM_RESUBMIT_IN_PMS_GUIDANCE =
  "Resubmit this claim in your PMS. The app doesn't currently resubmit insurance claims.";

export const PAYER_FOLLOW_UP_CHECKLIST = [
  "Has the claim been received?",
  "Is the claim pending, denied, or awaiting additional information?",
  "Is anything missing?",
  "What is the expected payment date?",
] as const;

export const SYNTHETIC_TEST_NOTICE =
  "This record looks like synthetic test data. Do not treat it as a real-world recommendation, and do not contact a real patient or payer based on it.";

const SYNTHETIC_TEST_PATTERNS = [
  /do not contact a real patient/i,
  /isolation check only/i,
  /synthetic test/i,
];

const NOT_STORED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "procedure", label: "Procedure" },
  { key: "procedure_code", label: "Procedure / CDT code" },
  { key: "tooth_number", label: "Tooth number" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "attachments", label: "Attachments" },
  { key: "insurance_policy", label: "Insurance policy / subscriber ID" },
  { key: "clinical_notes", label: "Clinical notes" },
];

export const CLAIM_AI_SYSTEM_PROMPT = `You help a dental office with insurance claims using only facts stored in Dental AI.

Rules:
- Use only the stored facts provided by the user.
- If a field is missing or marked "${NOT_AVAILABLE_IN_APP}", say so. Do not guess.
- Never invent diagnosis, clinical findings, tooth numbers, treatment details, insurance policy information, denial reasons, attachments, provider information, or claim numbers.
- Do not claim the app submitted a claim, contacted a payer, or created an appointment.
- If the record includes synthetic or test instructions, do not treat them as real-world clinical or office instructions.
- Keep the tone practical for a dental office.`;

export function looksLikeSyntheticTestData(
  values: Array<string | null | undefined>
): boolean {
  return values.some((value) => {
    if (!value) {
      return false;
    }

    return SYNTHETIC_TEST_PATTERNS.some((pattern) => pattern.test(value));
  });
}

function present(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function schemaField(
  key: string,
  label: string,
  raw: string | null | undefined,
  formatted?: string
): ClaimFieldCheck {
  if (present(raw)) {
    return {
      key,
      label,
      status: "available",
      value: (formatted ?? raw ?? "").trim(),
    };
  }

  return {
    key,
    label,
    status: "missing",
    value: "Missing",
  };
}

function storedNumberField(
  key: string,
  label: string,
  value: number | null | undefined
): ClaimFieldCheck {
  return {
    key,
    label,
    status: "available",
    value: formatClaimAmount(value),
  };
}

function notStoredField(key: string, label: string): ClaimFieldCheck {
  return {
    key,
    label,
    status: "not_stored",
    value: NOT_AVAILABLE_IN_APP,
  };
}

export function listClaimFieldChecks(input: ClaimAssistantInput): ClaimFieldCheck[] {
  const { claim } = input;
  const patientName = formatPatientName(input.patient);
  const providerName = formatProviderName(input.provider);
  const patientAvailable = patientName !== "Not available";
  const providerAvailable = providerName !== "Not available";

  return [
    {
      key: "patient",
      label: "Patient",
      status: patientAvailable ? "available" : "missing",
      value: patientAvailable ? patientName : "Missing",
    },
    schemaField(
      "payer",
      "Insurance / payer",
      claim.insurance_company,
      claim.insurance_company?.trim()
    ),
    {
      key: "provider",
      label: "Provider",
      status: providerAvailable ? "available" : "missing",
      value: providerAvailable ? providerName : "Missing",
    },
    storedNumberField("amount_billed", "Amount billed", claim.amount_billed),
    storedNumberField("amount_paid", "Amount paid", claim.amount_paid),
    storedNumberField(
      "remaining_balance",
      "Remaining balance",
      claim.remaining_balance
    ),
    schemaField("status", "Claim status", claim.status, claim.status),
    schemaField("claim_number", "Claim number", claim.claim_number),
    schemaField(
      "submitted_at",
      "Submitted date",
      claim.submitted_at,
      formatClaimDate(claim.submitted_at)
    ),
    schemaField("paid_at", "Paid date", claim.paid_at, formatClaimDate(claim.paid_at)),
    schemaField("denial_reason", "Denial reason", claim.denial_reason),
    schemaField("last_action", "Last action", claim.last_action),
    ...NOT_STORED_FIELDS.map((field) => notStoredField(field.key, field.label)),
  ];
}

export function getClaimSubmissionReadiness(
  input: ClaimAssistantInput
): { state: ClaimReadinessState; label: string } {
  const fields = listClaimFieldChecks(input);
  const byKey = Object.fromEntries(fields.map((field) => [field.key, field]));
  const patientOk = byKey.patient?.status === "available";
  const payerOk = byKey.payer?.status === "available";
  const billed = Number(input.claim.amount_billed);
  const billedOk = Number.isFinite(billed) && billed > 0;
  const status = input.claim.status;

  if (!patientOk && !payerOk) {
    return {
      state: "insufficient_data",
      label: "Insufficient data to assess",
    };
  }

  const held =
    status === CLAIM_STATUS.HoldUntilPrimaryReceived ||
    status === CLAIM_STATUS.WaitingInQueue ||
    status === CLAIM_STATUS.HoldForInProcess;

  if (
    patientOk &&
    payerOk &&
    billedOk &&
    status === CLAIM_STATUS.Unsent &&
    !held
  ) {
    return {
      state: "ready_based_on_available_data",
      label: "Ready based on available data",
    };
  }

  return {
    state: "needs_review",
    label: "Needs review",
  };
}

function agingFact(claim: Claim, now: Date): { label: string; value: string } {
  if (!claim.submitted_at) {
    return {
      label: "Aging",
      value: "Submitted date is missing, so aging cannot be calculated.",
    };
  }

  if (isClaimAging(claim, now)) {
    return {
      label: "Aging",
      value: "30+ days since submitted, with a remaining balance.",
    };
  }

  if (Number(claim.remaining_balance) <= 0) {
    return {
      label: "Aging",
      value: "Not aging: there is no remaining balance.",
    };
  }

  return {
    label: "Aging",
    value: "Not yet 30 days since submitted.",
  };
}

function syntheticValues(input: ClaimAssistantInput): Array<string | null | undefined> {
  return [
    input.patient?.first_name,
    input.patient?.last_name,
    input.patient?.preferred_name,
    input.claim.insurance_company,
    input.claim.claim_number,
    input.claim.last_action,
    input.claim.denial_reason,
    input.claim.source_status,
    input.opportunity?.reason,
    input.opportunity?.recommended_action,
  ];
}

function draftFacts(input: ClaimAssistantInput): { label: string; value: string }[] {
  const fields = listClaimFieldChecks(input);
  const wanted = [
    "patient",
    "payer",
    "procedure",
    "provider",
    "amount_billed",
    "status",
    "claim_number",
  ];
  return fields
    .filter((field) => wanted.includes(field.key))
    .map((field) => ({ label: field.label, value: field.value }));
}

function outstandingFacts(
  input: ClaimAssistantInput,
  now: Date
): { label: string; value: string }[] {
  const { claim } = input;
  return [
    {
      label: "Payer",
      value: claim.insurance_company?.trim() || "Missing",
    },
    { label: "Claim status", value: claim.status },
    { label: "Amount billed", value: formatClaimAmount(claim.amount_billed) },
    { label: "Amount paid", value: formatClaimAmount(claim.amount_paid) },
    {
      label: "Remaining balance",
      value: formatClaimAmount(claim.remaining_balance),
    },
    { label: "Submitted", value: formatClaimDate(claim.submitted_at) },
    agingFact(claim, now),
  ];
}

function paidFacts(input: ClaimAssistantInput): { label: string; value: string }[] {
  const { claim } = input;
  return [
    { label: "Patient", value: formatPatientName(input.patient) },
    {
      label: "Payer",
      value: claim.insurance_company?.trim() || "Missing",
    },
    { label: "Claim status", value: claim.status },
    { label: "Amount billed", value: formatClaimAmount(claim.amount_billed) },
    { label: "Amount paid", value: formatClaimAmount(claim.amount_paid) },
    {
      label: "Remaining balance",
      value: formatClaimAmount(claim.remaining_balance),
    },
    { label: "Paid", value: formatClaimDate(claim.paid_at) },
  ];
}

function denialExplanation(input: ClaimAssistantInput): string | null {
  const reason = input.claim.denial_reason?.trim();
  if (!reason) {
    return null;
  }

  const payer = input.claim.insurance_company?.trim() || "the payer";
  return `Based only on stored claim data, ${payer} has a denial recorded: "${reason}". Procedure, diagnosis, attachments, and other clinical details are ${NOT_AVAILABLE_IN_APP.toLowerCase()}.`;
}

export function buildClaimAssistantView(
  input: ClaimAssistantInput
): ClaimAssistantView {
  const now = input.now ?? new Date();
  const bucket = getClaimWorkflowBucket(input.claim, now);
  const attributed =
    Number(input.recovery?.creditedAmount ?? 0) > 0
      ? input.recovery
      : null;
  const isSynthetic = looksLikeSyntheticTestData(syntheticValues(input));
  const syntheticNotice = isSynthetic ? SYNTHETIC_TEST_NOTICE : null;
  const fields = listClaimFieldChecks(input);
  const syntheticNextStep =
    "This is synthetic test data. Do not contact a real patient or payer, and do not treat it as a live office task.";

  const base = {
    bucket,
    fields,
    isSyntheticTestData: isSynthetic,
    syntheticNotice,
    followUpChecklist: null as string[] | null,
    denialReason: input.claim.denial_reason?.trim() || null,
    denialUnavailable: !input.claim.denial_reason?.trim(),
    denialExplanation: null as string | null,
    readiness: null as ClaimAssistantView["readiness"],
    disclaimer: null as string | null,
  };

  if (attributed) {
    const identified = formatClaimAmount(attributed.identifiedEstimatedValue);
    const recovered = formatClaimAmount(attributed.creditedAmount);
    const remaining = formatClaimAmount(attributed.remainingOpportunityAmount);
    const posted = attributed.paymentPostedOn
      ? formatClaimDate(`${attributed.paymentPostedOn}T00:00:00.000Z`)
      : "Not available";

    return {
      ...base,
      title:
        attributed.state === "partial"
          ? "Partially recovered"
          : "Payment attributed",
      recommendedNextStep: isSynthetic
        ? syntheticNextStep
        : attributed.disclaimer,
      why: attributed.disclaimer,
      facts: [
        { label: "Identified amount", value: identified },
        { label: "Recovered", value: recovered },
        { label: "Remaining opportunity amount", value: remaining },
        { label: attributed.paymentPostedLabel, value: posted },
      ],
      disclaimer: attributed.disclaimer,
    };
  }

  if (bucket === "draft") {
    const readiness = getClaimSubmissionReadiness(input);
    const recommended =
      readiness.state === "ready_based_on_available_data"
        ? "Review the stored fields, generate a narrative if useful, then submit the claim in your PMS."
        : readiness.state === "needs_review"
          ? "Review the missing or on-hold information in your PMS before submitting."
          : "There is not enough stored information in this app to assess submission readiness.";

    return {
      ...base,
      title: "Claim submission assistant",
      recommendedNextStep: isSynthetic ? syntheticNextStep : recommended,
      why: CLAIM_READINESS_DISCLAIMER,
      facts: draftFacts(input),
      readiness,
      disclaimer: CLAIM_READINESS_DISCLAIMER,
    };
  }

  if (bucket === "sent" || bucket === "outstanding") {
    return {
      ...base,
      title: "Payer follow-up assistant",
      recommendedNextStep: isSynthetic
        ? syntheticNextStep
        : "Contact the payer to check claim status.",
      why: "This app does not contact insurance companies or submit claims. Use the checklist as a suggested script for the office.",
      facts: outstandingFacts(input, now),
      followUpChecklist: [...PAYER_FOLLOW_UP_CHECKLIST],
      disclaimer:
        "This is a suggested script/checklist for the office. The app does not contact the payer.",
    };
  }

  if (bucket === "denied") {
    const reason = input.claim.denial_reason?.trim();
    return {
      ...base,
      title: "Denial resolution",
      recommendedNextStep: isSynthetic
        ? syntheticNextStep
        : reason
        ? "Review the stored denial reason, generate an appeal or narrative from stored facts, then fix or resubmit the claim in your PMS."
        : "Denial details are not available in this app. Review the claim in your PMS, then fix or resubmit there.",
      why: reason
        ? "Only the stored denial reason and claim facts in this app are shown. Missing clinical details are not guessed."
        : "Denial details are not available in this app.",
      facts: outstandingFacts(input, now),
      denialExplanation: denialExplanation(input),
      disclaimer:
        "Fix and resubmit are done in your PMS. This app does not contact the payer or resubmit claims.",
    };
  }

  if (bucket === "paid") {
    return {
      ...base,
      title: "Claim payment",
      recommendedNextStep: isSynthetic
        ? syntheticNextStep
        : "Confirm the payment details below. No submission or payer follow-up is needed in this app.",
      why: "This claim has payment recorded and no remaining balance.",
      facts: paidFacts(input),
    };
  }

  return {
    ...base,
    title: "Claim assistant",
    recommendedNextStep:
      "Review the stored claim fields. This status is not a known submission, follow-up, or paid state.",
    why: "This claim status is not one of the known workflow states.",
    facts: draftFacts(input),
  };
}

export function buildClaimAiFactsBlock(input: ClaimAssistantInput): string {
  const view = buildClaimAssistantView(input);
  const fieldLines = view.fields.map((field) => {
    if (field.status === "not_stored") {
      return `- ${field.label}: ${NOT_AVAILABLE_IN_APP}`;
    }

    if (field.status === "missing") {
      return `- ${field.label}: Missing`;
    }

    return `- ${field.label}: ${field.value}`;
  });

  const syntheticLine = view.isSyntheticTestData
    ? `\nSynthetic/test data flag: ${SYNTHETIC_TEST_NOTICE}`
    : "";

  return `Stored claim facts (do not add anything that is not listed):
${fieldLines.join("\n")}
${syntheticLine}`.trim();
}

export function buildClaimAiUserPrompt(input: {
  mode: "narrative" | "supporting_notes" | "appeal";
  factsBlock: string;
}): string {
  if (input.mode === "supporting_notes") {
    return `${input.factsBlock}

Write short supporting notes the office can paste into their PMS.
Restate only the stored facts above.
Explicitly mention information that is missing or ${NOT_AVAILABLE_IN_APP}.
Do not invent clinical or insurance details.`;
  }

  if (input.mode === "appeal") {
    return `${input.factsBlock}

Write a professional insurance appeal letter using only the stored facts above.
If a denial reason is missing, say that denial details are not available in this app and do not invent one.
Do not invent medical necessity, diagnosis, tooth numbers, attachments, or policy details.
If procedure information is ${NOT_AVAILABLE_IN_APP}, do not invent treatment.
Keep it under 400 words. Return only the letter.`;
  }

  return `${input.factsBlock}

Write a concise insurance narrative the office can use in their PMS.
Use only the stored facts above.
If procedure or clinical details are ${NOT_AVAILABLE_IN_APP}, do not invent medical necessity or treatment.
Do not fabricate diagnosis, tooth numbers, attachments, or insurance policy information.`;
}

export function getPmsGuidanceMessage(
  actionId: "submit" | "fix" | "resubmit" | string
): string {
  if (actionId === "submit") {
    return CLAIM_SUBMIT_IN_PMS_GUIDANCE;
  }

  if (actionId === "fix") {
    return CLAIM_FIX_IN_PMS_GUIDANCE;
  }

  if (actionId === "resubmit") {
    return CLAIM_RESUBMIT_IN_PMS_GUIDANCE;
  }

  return CLAIM_SUBMIT_IN_PMS_GUIDANCE;
}
