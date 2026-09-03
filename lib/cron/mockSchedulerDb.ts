type Row = Record<string, unknown>;
type Filter =
  | ["eq", string, unknown]
  | ["in", string, unknown]
  | ["not", string, string, unknown];

/** Matches PostgREST's default max-rows when a query omits .range(). */
export const MOCK_POSTGREST_DEFAULT_MAX = 1000;

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => {
    if (filter[0] === "eq") {
      return row[filter[1]] === filter[2];
    }

    if (filter[0] === "in") {
      return Array.isArray(filter[2]) && filter[2].includes(row[filter[1]]);
    }

    const [, column, operator, value] = filter;

    if (operator === "is" && value === null) {
      return row[column] !== null && row[column] !== undefined;
    }

    return true;
  });
}

function compareValues(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left ?? "").localeCompare(String(right ?? ""));
}

export function createMemorySupabase(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    integrations: [],
    patients: [],
    procedure_codes: [],
    procedures: [],
    claims: [],
    recalls: [],
    revenue_opportunities: [],
  };

  for (const [table, rows] of Object.entries(seed)) {
    tables[table] = rows.map((row) => ({ ...row }));
  }

  function from(table: string) {
    const filters: Filter[] = [];
    let action: "select" | "insert" | "upsert" | "update" | "delete" =
      "select";
    let payload: unknown = null;
    let onConflict = "";
    let orderColumn: string | null = null;
    let rangeFrom: number | null = null;
    let rangeTo: number | null = null;

    const execute = async () => {
      const rows = tables[table] ?? (tables[table] = []);

      if (action === "select") {
        let data = rows.filter((row) => matches(row, filters));

        if (orderColumn) {
          const column = orderColumn;
          data = [...data].sort((left, right) =>
            compareValues(left[column], right[column])
          );
        }

        if (rangeFrom !== null && rangeTo !== null) {
          data = data.slice(rangeFrom, rangeTo + 1);
        } else {
          data = data.slice(0, MOCK_POSTGREST_DEFAULT_MAX);
        }

        return {
          data,
          error: null,
        };
      }

      if (action === "insert") {
        const inserted = (payload as Row[]).map((row) => ({
          id: row.id ?? crypto.randomUUID(),
          ...row,
        }));
        rows.push(...inserted);
        return { data: inserted, error: null };
      }

      if (action === "upsert") {
        const keys = onConflict
          .split(",")
          .map((key) => key.trim())
          .filter(Boolean);

        for (const row of payload as Row[]) {
          const index = rows.findIndex((existing) =>
            keys.every((key) => existing[key] === row[key])
          );

          if (index >= 0) {
            rows[index] = { ...rows[index], ...row, id: rows[index].id };
          } else {
            rows.push({ id: crypto.randomUUID(), ...row });
          }
        }

        return { data: null, error: null };
      }

      if (action === "update") {
        const updated: Row[] = [];

        for (let index = 0; index < rows.length; index += 1) {
          if (matches(rows[index], filters)) {
            rows[index] = { ...rows[index], ...(payload as Row) };
            updated.push(rows[index]);
          }
        }

        return { data: updated, error: null };
      }

      const remaining: Row[] = [];
      const deleted: Row[] = [];

      for (const row of rows) {
        if (matches(row, filters)) {
          deleted.push(row);
        } else {
          remaining.push(row);
        }
      }

      tables[table] = remaining;
      return { data: deleted, error: null };
    };

    const chain = {
      select(_columns?: string) {
        return chain;
      },
      eq(column: string, value: unknown) {
        filters.push(["eq", column, value]);
        return chain;
      },
      in(column: string, value: unknown[]) {
        filters.push(["in", column, value]);
        return chain;
      },
      not(column: string, operator: string, value: unknown) {
        filters.push(["not", column, operator, value]);
        return chain;
      },
      order(column: string) {
        orderColumn = column;
        return chain;
      },
      range(from: number, to: number) {
        rangeFrom = from;
        rangeTo = to;
        return chain;
      },
      insert(rows: Row[]) {
        action = "insert";
        payload = rows;
        return chain;
      },
      upsert(rows: Row[], options?: { onConflict?: string }) {
        action = "upsert";
        payload = rows;
        onConflict = options?.onConflict ?? "";
        return chain;
      },
      update(patch: Row) {
        action = "update";
        payload = patch;
        return chain;
      },
      delete() {
        action = "delete";
        return chain;
      },
      maybeSingle: async () => {
        const result = await execute();
        const data = Array.isArray(result.data)
          ? (result.data[0] ?? null)
          : result.data;
        return { data, error: result.error };
      },
      then(
        resolve: (value: Awaited<ReturnType<typeof execute>>) => unknown,
        reject?: (reason: unknown) => unknown
      ) {
        return execute().then(resolve, reject);
      },
    };

    return chain;
  }

  return {
    supabase: { from },
    tables,
  };
}
