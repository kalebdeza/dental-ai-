import { NextRequest } from "next/server";
import OpenAI from "openai";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { env } from "@/lib/api/env";
import { requirePractice } from "@/lib/auth/requirePractice";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
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

    const {
      patient,
      treatments,
      claims,
      recalls,
    } = await req.json();

    const prompt = `
You are an expert dental practice consultant.

Patient:
${JSON.stringify(patient, null, 2)}

Treatment Opportunities:
${JSON.stringify(treatments, null, 2)}

Insurance Claims:
${JSON.stringify(claims, null, 2)}

Recall Opportunities:
${JSON.stringify(recalls, null, 2)}

Write:

- Revenue summary
- Highest priority action
- Recommended next 3 actions
- Short motivational summary for office staff

Keep it under 200 words.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.5",
      messages: [
        {
          role: "system",
          content:
            "You are the world's best dental revenue consultant.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return ApiResponse.ok({
      recommendation:
        completion.choices[0].message.content,
    });
  } catch (error) {
    logger.error("Patient AI request failed", error);

    return ApiErrorHandler.handle(error);
  }
}