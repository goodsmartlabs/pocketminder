import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { processDueNotifications } from "@/server/notifications";

export const dynamic = "force-dynamic";

/**
 * Process notifications for every user. Point a scheduler (cron, Vercel Cron,
 * GitHub Actions...) at this with `Authorization: Bearer $CRON_SECRET`. Needed
 * once email/push channels exist; in-app/browser also work without it.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const users = getDb()
    .select({ id: schema.users.id, timezone: schema.users.timezone })
    .from(schema.users)
    .all();
  let sent = 0;
  for (const u of users) sent += await processDueNotifications(u.id, u.timezone, { force: true });
  return NextResponse.json({ users: users.length, sent });
}
