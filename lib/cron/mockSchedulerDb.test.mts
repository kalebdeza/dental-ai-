import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createMemorySupabase,
  MOCK_POSTGREST_DEFAULT_MAX,
} from "./mockSchedulerDb.ts";

describe("memory supabase PostgREST cap", () => {
  it("truncates uncapped selects at 1,000 rows so missing pagination cannot hide", async () => {
    const rows = Array.from({ length: 1205 }, (_, index) => ({
      id: `row-${String(index + 1).padStart(4, "0")}`,
    }));
    const memory = createMemorySupabase({ patients: rows });

    const uncapped = await memory.supabase.from("patients").select("id");
    assert.equal(MOCK_POSTGREST_DEFAULT_MAX, 1000);
    assert.equal(uncapped.data?.length, 1000);

    const page = await memory.supabase
      .from("patients")
      .select("id")
      .order("id")
      .range(1000, 1999);
    assert.equal(page.data?.length, 205);
    assert.equal(page.data?.[0]?.id, "row-1001");
  });
});
