import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("integrations.customer_key privileges", () => {
  it("revokes authenticated SELECT on customer_key and keeps service_role SELECT", () => {
    const sql = readFileSync(
      fileURLToPath(
        new URL(
          "../../supabase/migrations/20260910000000_revoke_authenticated_integration_customer_key.sql",
          import.meta.url
        )
      ),
      "utf8"
    );

    assert.match(
      sql,
      /revoke select \(customer_key\)\s+on table public\.integrations\s+from authenticated/i
    );
    assert.match(
      sql,
      /grant select \(customer_key\)\s+on table public\.integrations\s+to service_role/i
    );
    assert.doesNotMatch(
      sql,
      /revoke select[\s\S]*from service_role/i
    );
  });

  it("loads the customer key with the service-role client, not the browser session select of customer_key", () => {
    const source = readFileSync(
      fileURLToPath(
        new URL("../../services/integrationService.ts", import.meta.url)
      ),
      "utf8"
    );

    assert.match(source, /createSchedulerClient/);
    assert.match(source, /select\("id,status"\)/);
    assert.match(source, /select\("id,customer_key,status"\)/);
    assert.match(source, /createClient\(\)/);
    assert.match(source, /\.select\("id"\)/);
    assert.equal((source.match(/\.select\("id"\)/g) ?? []).length, 3);
  });
});
