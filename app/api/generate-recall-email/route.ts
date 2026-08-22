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

    const { patient, recalls } = await req.json();

    const prompt = `
Write a warm, professional dental recall email.

Patient:
${JSON.stringify(patient, null, 2)}

Recall Information:
${JSON.stringify(recalls, null, 2)}

Requirements:
- Friendly tone
- Mention the patient's first name
- Encourage scheduling
- Keep under 180 words
- Return only the email
`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.5",
      messages: [
        {
          role: "system",
          content:
            "You are an expert dental office patient communication assistant.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return ApiResponse.ok({
      email: response.choices[0].message.content,
    });
  } catch (error) {
    logger.error("Recall email generation failed", error);

    return ApiErrorHandler.handle(error);
  }
}