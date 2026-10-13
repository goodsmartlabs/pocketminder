#!/usr/bin/env node
/**
 * List PocketMinder accounts in the database (read-only).
 *
 *   DATABASE_URL=postgres://... node scripts/accounts.mjs
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("Set DATABASE_URL to the PocketMinder Postgres connection string.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
const rows = await sql`
  SELECT u.email, u.name, u.created_at AS "createdAt",
         (SELECT COUNT(*)::int FROM reminders r WHERE r.user_id = u.id) AS reminders
    FROM users u ORDER BY u.created_at`;

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
await sql.end();
