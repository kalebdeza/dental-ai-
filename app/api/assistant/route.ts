import { NextRequest } from "next/server";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";

import { requirePractice } from "@/lib/auth/requirePractice";
import { generatePracticeResponse } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { success } = await checkRateLimit(req, 20, "1 m");

    if (!success) {
      return ApiResponse.tooManyRequests(
        "Too many AI requests. Please try again in a minute."
      );
    }

    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { supabase } = auth;
    const { message } = await req.json();

    const [
      { data: patients },
      { data: claims },
      { data: opportunities },
    ] = await Promise.all([
      supabase.from("patients").select("*"),

      supabase.from("claims").select("*"),

      supabase
        .from("revenue_opportunities")
        .select("*")
        .eq("completed", false),
    ]);

    const patientLookup = new Map();

    (patients ?? []).forEach((patient) => {
      patientLookup.set(patient.id, patient);
    });

    const treatmentOpportunities = (
      opportunities ?? []
    ).filter(
      (opportunity) =>
        opportunity.opportunity_type === "Treatment"
    );

    const recallOpportunities = (
      opportunities ?? []
    ).filter(
      (opportunity) =>
        opportunity.opportunity_type === "Recall"
    );

    const claimOpportunities = (
      opportunities ?? []
    ).filter(
      (opportunity) =>
        opportunity.opportunity_type === "Claim"
    );

    const treatmentRevenue =
      treatmentOpportunities.reduce(
        (sum, opportunity) =>
          sum +
          Number(
            opportunity.estimated_value ?? 0
          ),
        0
      );

    const recallRevenue =
      recallOpportunities.reduce(
        (sum, opportunity) =>
          sum +
          Number(
            opportunity.estimated_value ?? 0
          ),
        0
      );

    const claimRevenue =
      claimOpportunities.reduce(
        (sum, opportunity) =>
          sum +
          Number(
            opportunity.estimated_value ?? 0
          ),
        0
      );

    const totalRecoverableRevenue =
      treatmentRevenue +
      recallRevenue +
      claimRevenue;

    const topTreatments = [
      ...treatmentOpportunities,
    ]
      .sort(
        (a, b) =>
          Number(b.estimated_value ?? 0) -
          Number(a.estimated_value ?? 0)
      )
      .slice(0, 10);

    const treatmentSummary =
      topTreatments.map((treatment) => {
        const patient = patientLookup.get(
          treatment.patient_id
        );

        return {
          patientName: patient
            ? `${patient.first_name} ${patient.last_name}`
            : "Unknown Patient",

          phone:
            patient?.mobile_phone ??
            patient?.home_phone ??
            "Unknown",

          email:
            patient?.email ?? "Unknown",

          treatment:
            treatment.reason,

          estimatedRevenue:
            treatment.estimated_value,

          priority:
            treatment.priority,

          recommendedAction:
            treatment.recommended_action,

          status: treatment.completed
            ? "Completed"
            : "Open",
        };
      });

    const topRecalls = [
      ...recallOpportunities,
    ]
      .sort(
        (a, b) =>
          Number(b.estimated_value ?? 0) -
          Number(a.estimated_value ?? 0)
      )
      .slice(0, 10);

    const recallSummary =
      topRecalls.map((recall) => {
        const patient = patientLookup.get(
          recall.patient_id
        );

        return {
          patientName: patient
            ? `${patient.first_name} ${patient.last_name}`
            : "Unknown Patient",

          phone:
            patient?.mobile_phone ??
            patient?.home_phone ??
            "Unknown",

          email:
            patient?.email ?? "Unknown",

          estimatedRevenue:
            recall.estimated_value,

          priority:
            recall.priority,

          reason:
            recall.reason,

          recommendedAction:
            recall.recommended_action,

          status: recall.completed
            ? "Completed"
            : "Open",
        };
      });

    const openClaims = (
      claims ?? []
    ).slice(0, 10);

    const claimSummary =
      openClaims.map((claim) => {
        const patient = patientLookup.get(
          claim.patient_id
        );

        const opportunity =
          claimOpportunities.find(
            (item) =>
              item.claim_id === claim.id
          );

        return {
          patientName: patient
            ? `${patient.first_name} ${patient.last_name}`
            : "Unknown Patient",

          phone:
            patient?.mobile_phone ??
            patient?.home_phone ??
            "Unknown",

          email:
            patient?.email ?? "Unknown",

          claimNumber:
            claim.claim_number,

          insuranceCompany:
            claim.insurance_company,

          status:
            claim.status,

          amountBilled:
            claim.amount_billed,

          amountPaid:
            claim.amount_paid,

          remainingBalance:
            claim.remaining_balance,

          denialReason:
            claim.denial_reason,

          lastAction:
            claim.last_action,

          potentialRecovery:
            opportunity?.estimated_value ??
            claim.remaining_balance ??
            0,
        };
      });

    const patientDirectory = (
      patients ?? []
    )
      .slice(0, 20)
      .map(
        (p) =>
          `${p.first_name} ${p.last_name}
Phone: ${
  p.mobile_phone ??
  p.home_phone ??
  "Unknown"
}
Email: ${p.email ?? "Unknown"}`
      )
      .join("\n\n");

    function includesAny(
      text: string,
      keywords: string[]
    ) {
      const lower = text.toLowerCase();

      return keywords.some((keyword) =>
        lower.includes(keyword)
      );
    }

    let practiceContext = `
PRACTICE SUMMARY

Total Recoverable Revenue:
$${totalRecoverableRevenue.toLocaleString()}

Patients:
${patients?.length ?? 0}

Claims:
${claims?.length ?? 0}

Treatment Opportunities:
${treatmentOpportunities.length}

Recall Opportunities:
${recallOpportunities.length}

Claim Opportunities:
${claimOpportunities.length}
`;

    if (
      includesAny(message, [
        "claim",
        "insurance",
        "paid",
        "payment",
        "denied",
        "balance",
      ])
    ) {
      practiceContext += `

CLAIMS

${JSON.stringify(
  claimSummary,
  null,
  2
)}
`;
    }

    if (
      includesAny(message, [
        "recall",
        "overdue",
        "hygiene",
      ])
    ) {
      practiceContext += `

RECALLS

${JSON.stringify(
  recallSummary,
  null,
  2
)}
`;
    }

    if (
      includesAny(message, [
        "treatment",
        "production",
        "revenue",
        "schedule",
      ])
    ) {
      practiceContext += `

TREATMENTS

${JSON.stringify(
  treatmentSummary,
  null,
  2
)}
`;
    }

    if (
      includesAny(message, [
        "patient",
        "phone",
        "email",
        "contact",
      ])
    ) {
      practiceContext += `

PATIENT DIRECTORY

${patientDirectory}
`;
    }

    const reply =
      await generatePracticeResponse(
        practiceContext,
        message
      );

    return ApiResponse.ok({
      success: true,
      reply,
    });
  } catch (error) {
    logger.error(
      "AI assistant request failed",
      error
    );

    return ApiErrorHandler.handle(error);
  }
}