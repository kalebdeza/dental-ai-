import { z } from "zod";

export const testConnectionSchema = z.object({
  customerKey: z
    .string()
    .trim()
    .min(1, "Customer API Key is required.")
    .max(255, "Customer API Key is too long."),
});

export type TestConnectionInput = z.infer<
  typeof testConnectionSchema
>;