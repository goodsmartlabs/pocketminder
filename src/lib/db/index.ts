import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Postgres (Supabase) connection.
 *
 * DATABASE_URL should be Supabase's *transaction pooler* URL (port 6543),
 * which suits serverless hosting such as Vercel. Prepared statements are
 * disabled because the transaction pooler doesn't support them.
 */
export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { __pocketminderDb?: DB };

function open(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const client = postgres(url, {
    prepare: false,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema }) as unknown as DB;
}

export function getDb(): DB {
  if (!globalForDb.__pocketminderDb) globalForDb.__pocketminderDb = open();
  return globalForDb.__pocketminderDb;
}

/** Tests inject an in-memory Postgres (PGlite) here. */
export function setDbForTests(db: DB): void {
  globalForDb.__pocketminderDb = db;
}

export { schema };
