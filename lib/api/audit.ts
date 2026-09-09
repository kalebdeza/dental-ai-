import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { logger } from "./logger.ts";

type AuditLogInput = {
  userId?: string | null;
  practiceId?: string | null;
  action: string;
  resource?: string | null;
  metadata?: Json | null;
};

export async function auditLog({
  userId,
  practiceId,
  action,
  resource,
  metadata,
}: AuditLogInput) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("audit_logs")
    .insert({
      user_id: userId ?? null,
      practice_id: practiceId ?? null,
      action,
      resource: resource ?? null,
      metadata: metadata ?? null,
    });

  if (error) {
    logger.error("Audit log failed", {
      code: error.code,
    });
  }
}