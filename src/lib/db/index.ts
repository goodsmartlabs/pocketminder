import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

export const DATA_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.POCKETMINDER_DATA_DIR ?? "./data",
);
const DB_PATH =
  process.env.DATABASE_PATH ?? path.join(/*turbopackIgnore: true*/ DATA_DIR, "pocketminder.db");

function open(): DB {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  // Keep a consistent recovery copy before upgrading an existing pre-Spaces database.
  const hasUsers = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  const hasSpaces = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='spaces'").get();
  const backupPath = path.join(path.dirname(DB_PATH), "pre-spaces-backup.db");
  if (hasUsers && !hasSpaces && !fs.existsSync(backupPath)) {
    sqlite.prepare("VACUUM INTO ?").run(backupPath);
  }
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __pocketminderDb?: DB };

export function getDb(): DB {
  if (!globalForDb.__pocketminderDb) globalForDb.__pocketminderDb = open();
  return globalForDb.__pocketminderDb;
}

export { schema };
