import { NextRequest } from "next/server";
import { generateClaimNarrative } from "@/lib/openai";

import { ApiResponse } from "@/lib/api/response";
import { aiGuard } from "@/lib/api/aiGuard";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { requirePractice } from "@/lib/auth/requirePractice";
import {
  buildClaimAiFactsBlock,
  buildClaimAiUserPrompt,
} from "@/lib/data/claimAssistant";
import { loadPracticeClaimWithDetails } from "@/lib/data/claims";

const NARRATIVE_MODES = ["narrative", "supporting_notes"] as const;

function isNarrativeMode(
  value: unknown
): value is (typeof NARRATIVE_MODES)[number] {
  return (
    typeof value === "string" &&
    (NARRATIVE_MODES as readonly string[]).includes(value)
  );
}

export async function POST(req: NextRequest) {
  try {
    const disabled = aiGuard();

    if (disabled) {
      return disabled;
    }

    const { success } = await checkRateLimit(req, 10, "1 m");

    if (!success) {
      return ApiResponse.tooManyRequests(
        "Too many AI requests. Please try again in a minute."
      );
    }

    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const body = await req.json();
    const claimId =
      typeof body.claimId === "string" ? body.claimId.trim() : "";
    const mode = isNarrativeMode(body.mode) ? body.mode : "narrative";

    if (!claimId) {
      return ApiResponse.badRequest("claimId is required.");
    }

    const claim = await loadPracticeClaimWithDetails(
      auth.supabase,
      auth.practice.id,
      claimId
    );

    if (!claim) {
      return ApiResponse.notFound("Claim not found.");
    }

    const factsBlock = buildClaimAiFactsBlock({
      claim,
      patient: claim.patient,
      provider: claim.provider,
      opportunity: claim.opportunity,
    });
    const narrative = await generateClaimNarrative(
      buildClaimAiUserPrompt({ mode, factsBlock })
    );

    return ApiResponse.ok({
      success: true,
      narrative,
    });
  } catch (error) {
    logger.error("Claim narrative generation failed", error);

    return ApiErrorHandler.handle(error);
  }
}
