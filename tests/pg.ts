import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
import { setDbForTests, type DB } from "@/lib/db";

/** An in-memory Postgres (PGlite) with every migration in drizzle/ applied. */
export async function freshDb(): Promise<{ client: PGlite; db: DB }> {
  const client = new PGlite();
  const dir = path.resolve(import.meta.dirname, "../drizzle");
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await client.exec(
      fs
        .readFileSync(path.join(dir, file), "utf8")
        .replaceAll("--> statement-breakpoint", ""),
    );
  }
  const db = drizzle(client, { schema }) as unknown as DB;
  setDbForTests(db);
  return { client, db };
}
