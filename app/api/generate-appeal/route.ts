import { NextRequest } from "next/server";
import OpenAI from "openai";

import { ApiResponse } from "@/lib/api/response";
import { aiGuard } from "@/lib/api/aiGuard";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { env } from "@/lib/api/env";
import { requirePractice } from "@/lib/auth/requirePractice";
import {
  CLAIM_AI_SYSTEM_PROMPT,
  buildClaimAiFactsBlock,
  buildClaimAiUserPrompt,
} from "@/lib/data/claimAssistant";
import { loadPracticeClaimWithDetails } from "@/lib/data/claims";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

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

    let userPrompt: string;

    if (claimId) {
      const claim = await loadPracticeClaimWithDetails(
        auth.supabase,
        auth.practice.id,
        claimId
      );

      if (!claim) {
        return ApiResponse.notFound("Claim not found.");
      }

      userPrompt = buildClaimAiUserPrompt({
        mode: "appeal",
        factsBlock: buildClaimAiFactsBlock({
          claim,
          patient: claim.patient,
          provider: claim.provider,
          opportunity: claim.opportunity,
        }),
      });
    } else {
      const { patient, claims } = body;
      userPrompt = buildClaimAiUserPrompt({
        mode: "appeal",
        factsBlock: `Stored facts from the request (do not add anything that is not listed):
Patient:
${JSON.stringify(patient ?? {}, null, 2)}

Claims:
${JSON.stringify(claims ?? [], null, 2)}`,
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.5",
      messages: [
        {
          role: "system",
          content: CLAIM_AI_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    return ApiResponse.ok({
      letter: response.choices[0].message.content,
    });
  } catch (error) {
    logger.error("Insurance appeal generation failed", error);

    return ApiErrorHandler.handle(error);
  }
}
