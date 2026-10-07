import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  ackBrowserDeliveries,
  pendingBrowserDeliveries,
  processDueNotifications,
  unreadCount,
} from "@/server/notifications";

export const dynamic = "force-dynamic";

/** Polled by the open tab: runs the scheduler, returns badge count + browser notifications. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await processDueNotifications(user.id, user.timezone);
  return NextResponse.json({
    sent,
    unread: unreadCount(user.id),
    browser: pendingBrowserDeliveries(user.id),
  });
}

const ackSchema = z.object({ deliveryIds: z.array(z.string()).max(50) });

/** Acknowledge browser notifications the tab has shown. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = ackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  ackBrowserDeliveries(user.id, parsed.data.deliveryIds);
  return NextResponse.json({ ok: true });
}
