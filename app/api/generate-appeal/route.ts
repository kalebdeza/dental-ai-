import { NextRequest } from "next/server";
import OpenAI from "openai";

import { ApiResponse } from "@/lib/api/response";
import { aiGuard } from "@/lib/api/aiGuard";
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

    const { patient, claims } = await req.json();

    const prompt = `
You are an insurance appeals specialist for dental practices.

Patient:
${JSON.stringify(patient, null, 2)}

Claims:
${JSON.stringify(claims, null, 2)}

Write a professional insurance appeal letter.

Include:
- Date
- Greeting
- Reason for appeal
- Medical necessity explanation
- Request for reconsideration
- Professional closing

Keep it under 400 words.

Return only the letter.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.5",
      messages: [
        {
          role: "system",
          content:
            "You write professional dental insurance appeal letters.",
        },
        {
          role: "user",
          content: prompt,
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