import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  OPENAI_API_KEY: z.string().min(1),

  OPEN_DENTAL_API_URL: z.string().url(),
  OPEN_DENTAL_DEVELOPER_KEY: z.string().min(1),

  ENCRYPTION_KEY: z
    .string()
    .length(64, "ENCRYPTION_KEY must be 64 hexadecimal characters."),

  // Routes that send patient data to OpenAI stay disabled until a BAA and
  // zero-retention terms are in place. Defaults closed so an unset or
  // misspelled value can never enable PHI disclosure.
  AI_PHI_ENABLED: z
    .enum(["true", "false"])
    .default("false"),
});

export const env = envSchema.parse(process.env);