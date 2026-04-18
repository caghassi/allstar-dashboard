import postgres, { type Sql } from "postgres";

// Tagged-template SQL client backed by postgres-js. Usage:
//   const rows = await sql`select * from leads where status = ${status}`;
//
// Works against any Postgres server. For Supabase, point DATABASE_URL at the
// transaction pooler (port 6543) — `prepare: false` below is required for
// that pooler and harmless elsewhere.

let cached: Sql | null = null;

export function sql(): Sql {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  cached = postgres(url, {
    prepare: false,
    // Serverless functions are short-lived; one connection per invocation
    // is plenty and avoids the pooler running out of slots.
    max: 1,
    idle_timeout: 20,
    types: {
      // Return bigint (int8) as a JS number. All bigint columns in this app
      // hold cents and stay well under Number.MAX_SAFE_INTEGER.
      bigint: {
        to: 20,
        from: [20],
        serialize: (v: number | bigint) => String(v),
        parse: (v: string) => Number(v),
      },
    },
  });
  return cached;
}

// Convenience for places that want to call it like a tagged template without
// re-calling `sql()` every time.
export const db: Sql = new Proxy(
  (() => {}) as unknown as Sql,
  {
    apply(_t, _this, args: unknown[]) {
      // @ts-expect-error - passthrough to the postgres-js tagged template
      return sql()(...args);
    },
    get(_t, prop) {
      const client = sql() as unknown as Record<string | symbol, unknown>;
      return client[prop];
    },
  }
);
