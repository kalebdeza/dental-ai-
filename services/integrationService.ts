import "server-only";

import { encrypt, decrypt } from "@/lib/security/encryption";
import { createClient } from "@/lib/supabase/server";
import { createSchedulerClient } from "@/lib/supabase/scheduler";

class IntegrationService {
  async saveOpenDentalCredentials(
    practiceId: string,
    customerKey: string
  ) {
    const supabase = await createClient();

    // Encrypt before storing
    const encryptedKey = encrypt(customerKey);

    // Check if an Open Dental integration already exists
    const { data: existing, error: lookupError } =
      await supabase
        .from("integrations")
        .select("id")
        .eq("practice_id", practiceId)
        .eq("provider", "opendental")
        .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    // Update existing integration
    if (existing) {
      const { error } = await supabase
        .from("integrations")
        .update({
          customer_key: encryptedKey,
          status: "connected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id");

      if (error) {
        throw error;
      }

      return;
    }

    // Create new integration
    const { error } = await supabase
      .from("integrations")
      .insert({
        practice_id: practiceId,
        provider: "opendental",
        customer_key: encryptedKey,
        status: "connected",
      })
      .select("id");

    if (error) {
      throw error;
    }
  }

  async getOpenDentalIntegration(
    practiceId: string
  ): Promise<{
    id: string;
    customerKey: string;
  }> {
    const userClient = await createClient();

    const { data: visible, error: visibleError } = await userClient
      .from("integrations")
      .select("id,status")
      .eq("practice_id", practiceId)
      .eq("provider", "opendental")
      .maybeSingle();

    if (visibleError) {
      throw visibleError;
    }

    if (!visible) {
      throw new Error("Open Dental integration not found.");
    }

    if (visible.status !== "connected") {
      throw new Error("Open Dental integration is not connected.");
    }

    const supabase = createSchedulerClient();

    const { data: integration, error } = await supabase
      .from("integrations")
      .select("id,customer_key,status")
      .eq("id", visible.id)
      .eq("practice_id", practiceId)
      .eq("provider", "opendental")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!integration?.customer_key || integration.status !== "connected") {
      throw new Error("Open Dental customer key is missing.");
    }

    return {
      id: integration.id,
      customerKey: decrypt(integration.customer_key),
    };
  }
}

export const integrationService =
  new IntegrationService();
