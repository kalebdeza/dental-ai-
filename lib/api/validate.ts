import { NextRequest } from "next/server";
import { ZodSchema } from "zod";

export async function validate<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  const body = await req.json();

  return schema.parse(body);
}