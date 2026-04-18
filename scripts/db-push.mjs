#!/usr/bin/env node
// Apply src/db/schema.sql to the Postgres database pointed to by DATABASE_URL.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, "..", "src", "db", "schema.sql");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Put it in .env.local.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const schema = readFileSync(schemaPath, "utf8");

// Split on ';' at end of line. Keep SQL with inline/leading comments intact
// (Postgres ignores them). Drop chunks that are only comments/whitespace.
const statements = schema
  .split(/;\s*(?:\n|$)/m)
  .map((s) => s.trim())
  .filter(
    (s) => s.length && s.replace(/--[^\n]*/g, "").trim().length,
  );

for (const stmt of statements) {
  try {
    await sql.unsafe(stmt);
    const firstSql =
      stmt
        .split("\n")
        .find((l) => l.trim().length && !l.trim().startsWith("--")) ?? stmt;
    console.log("ok:", firstSql.slice(0, 80));
  } catch (err) {
    console.error("FAILED:", stmt.split("\n")[0]);
    console.error(err.message);
    await sql.end();
    process.exit(1);
  }
}

await sql.end();
console.log("\nSchema applied.");
