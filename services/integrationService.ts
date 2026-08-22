import { encrypt, decrypt } from "@/lib/security/encryption";
import { createClient } from "@/lib/supabase/server";

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
        .eq("id", existing.id);

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
      });

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
    const supabase = await createClient();

    const { data: integration, error } =
      await supabase
        .from("integrations")
        .select("id,customer_key,status")
        .eq("practice_id", practiceId)
        .eq("provider", "opendental")
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (!integration) {
      throw new Error(
        "Open Dental integration not found."
      );
    }

    if (!integration.customer_key) {
      throw new Error(
        "Open Dental customer key is missing."
      );
    }

    if (integration.status !== "connected") {
      throw new Error(
        "Open Dental integration is not connected."
      );
    }

    return {
      id: integration.id,
      customerKey: decrypt(
        integration.customer_key
      ),
    };
  }
}

export const integrationService =
  new IntegrationService();