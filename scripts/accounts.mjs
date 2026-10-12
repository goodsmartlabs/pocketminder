#!/usr/bin/env node
/**
 * List PocketMinder accounts in the database (read-only).
 *
 *   node scripts/accounts.mjs
 *
 * On Railway: `railway ssh` into the service, then run the command above.
 * Uses POCKETMINDER_DATA_DIR (default ./data) or DATABASE_PATH like the app does.
 */
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const dataDir = path.resolve(process.env.POCKETMINDER_DATA_DIR ?? "./data");
const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, "pocketminder.db");

if (!fs.existsSync(dbPath)) {
  console.log(`No database found at ${dbPath}.`);
  console.log("Nobody has signed up on this server yet, or the persistent volume isn't mounted here.");
  process.exit(0);
}

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const rows = db
  .prepare(
    `SELECT u.email, u.name, u.created_at AS createdAt,
            (SELECT COUNT(*) FROM reminders r WHERE r.user_id = u.id) AS reminders
       FROM users u ORDER BY u.created_at`,
  )
  .all();

console.log(`Database: ${dbPath}`);
if (rows.length === 0) {
  console.log("No accounts yet. Create one at /signup.");
} else {
  console.table(
    rows.map((r) => ({
      email: r.email,
      name: r.name,
      created: new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " "),
      reminders: r.reminders,
    })),
  );
}
db.close();
