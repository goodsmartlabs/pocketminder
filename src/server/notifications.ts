import "server-only";
import { and, count, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { addDays, todayISO, type ISODate } from "@/lib/dates";
import { OVERDUE_RENOTIFY_DAYS, type ReminderType } from "@/lib/domain";
import { CHANNELS } from "@/lib/notifications/channels";
import {
  allowedByLevel,
  collapseDue,
  notificationText,
} from "@/lib/notifications/schedule";
import type { NotificationView } from "@/lib/types";
import { getSettings } from "./reminders";

/**
 * Notification engine.
 *
 * `processDueNotifications` is idempotent and cheap; it runs whenever the
 * user's open tab polls, and can also be driven by a cron hitting
 * /api/cron/notifications for every user (needed for email/push later).
 */

const lastRun = new Map<string, number>();
const MIN_INTERVAL_MS = 30_000;

export async function processDueNotifications(
  userId: string,
  timezone: string,
  opts: { force?: boolean; now?: Date } = {},
): Promise<number> {
  const nowMs = (opts.now ?? new Date()).getTime();
  if (!opts.force && nowMs - (lastRun.get(userId) ?? 0) < MIN_INTERVAL_MS) return 0;
  lastRun.set(userId, nowMs);

  const db = getDb();
  const today = todayISO(timezone, opts.now);
  const settings = getSettings(userId);
  const activeSpaces = new Set(db.select({id:schema.spaces.id}).from(schema.spaces).where(and(eq(schema.spaces.userId,userId),eq(schema.spaces.status,"active"))).all().map(s=>s.id));

  const due = db
    .select({
      n: schema.reminderNotifications,
      r: {
        spaceId: schema.reminders.spaceId,
        id: schema.reminders.id,
        title: schema.reminders.title,
        importantDate: schema.reminders.importantDate,
        reminderType: schema.reminders.reminderType,
        status: schema.reminders.status,
        snoozedUntil: schema.reminders.snoozedUntil,
      },
    })
    .from(schema.reminderNotifications)
    .innerJoin(schema.reminders, eq(schema.reminders.id, schema.reminderNotifications.reminderId))
    .where(
      and(
        eq(schema.reminderNotifications.userId, userId),
        eq(schema.reminderNotifications.status, "pending"),
        lte(schema.reminderNotifications.scheduledFor, today),
      ),
    )
    .all();

  type Reminder = (typeof due)[number]["r"];
  const byReminder = new Map<string, { r: Reminder; items: (typeof due)[number]["n"][] }>();
  for (const row of due) {
    if (!activeSpaces.has(row.r.spaceId)) continue;
    const entry = byReminder.get(row.r.id) ?? { r: row.r, items: [] };
    entry.items.push(row.n);
    byReminder.set(row.r.id, entry);
  }

  const toSend: { notificationId: string; r: Reminder; kind: NotificationView["kind"] }[] = [];

  db.transaction((tx) => {
    for (const { r, items } of byReminder.values()) {
      if (r.status !== "active") {
        tx.update(schema.reminderNotifications)
          .set({ status: "cancelled" })
          .where(inArray(schema.reminderNotifications.id, items.map((i) => i.id)))
          .run();
        continue;
      }
      if (r.snoozedUntil && r.snoozedUntil > today) continue;

      const { send, skip } = collapseDue(items);
      if (skip.length) {
        tx.update(schema.reminderNotifications)
          .set({ status: "skipped" })
          .where(inArray(schema.reminderNotifications.id, skip.map((i) => i.id)))
          .run();
      }
      if (!send) continue;
      if (!allowedByLevel(send.kind, send.offsetDays, settings.notificationLevel)) {
        tx.update(schema.reminderNotifications)
          .set({ status: "skipped" })
          .where(eq(schema.reminderNotifications.id, send.id))
          .run();
        continue;
      }
      toSend.push({ notificationId: send.id, r, kind: send.kind });
    }

    // Overdue items keep surfacing (weekly) until the user resolves them.
    const overdue = tx
      .select({
        spaceId: schema.reminders.spaceId,
        id: schema.reminders.id,
        title: schema.reminders.title,
        importantDate: schema.reminders.importantDate,
        reminderType: schema.reminders.reminderType,
        status: schema.reminders.status,
        snoozedUntil: schema.reminders.snoozedUntil,
      })
      .from(schema.reminders)
      .where(
        and(
          eq(schema.reminders.userId, userId),
          eq(schema.reminders.status, "active"),
          lte(schema.reminders.importantDate, addDays(today, -1)),
        ),
      )
      .all();
    if (overdue.length) {
      const recent = tx
        .select({
          reminderId: schema.reminderNotifications.reminderId,
          scheduledFor: schema.reminderNotifications.scheduledFor,
        })
        .from(schema.reminderNotifications)
        .where(
          and(
            eq(schema.reminderNotifications.userId, userId),
            eq(schema.reminderNotifications.kind, "overdue"),
            inArray(
              schema.reminderNotifications.reminderId,
              overdue.map((o) => o.id),
            ),
          ),
        )
        .all();
      const lastOverdue = new Map<string, ISODate>();
      for (const n of recent) {
        const cur = lastOverdue.get(n.reminderId);
        if (!cur || n.scheduledFor > cur) lastOverdue.set(n.reminderId, n.scheduledFor);
      }
      const threshold = addDays(today, -OVERDUE_RENOTIFY_DAYS);
      for (const r of overdue) {
        if (!activeSpaces.has(r.spaceId)) continue;
        if (r.snoozedUntil && r.snoozedUntil > today) continue;
        if (toSend.some((s) => s.r.id === r.id)) continue;
        const last = lastOverdue.get(r.id);
        if (last && last > threshold) continue;
        const n = tx
          .insert(schema.reminderNotifications)
          .values({ reminderId: r.id, userId, kind: "overdue", scheduledFor: today })
          .returning({ id: schema.reminderNotifications.id })
          .get();
        toSend.push({ notificationId: n.id, r, kind: "overdue" });
      }
    }

    const sentAt = new Date();
    const enabledChannels = CHANNELS.filter((c) => c.available && c.isEnabled(settings));
    for (const s of toSend) {
      const text = notificationText(
        {
          title: s.r.title,
          importantDate: s.r.importantDate,
          reminderType: s.r.reminderType as ReminderType,
        },
        s.kind,
        today,
      );
      tx.update(schema.reminderNotifications)
        .set({ status: "sent", sentAt, title: text.title, body: text.body })
        .where(eq(schema.reminderNotifications.id, s.notificationId))
        .run();
      for (const channel of enabledChannels) {
        tx.insert(schema.notificationDeliveries)
          .values({
            notificationId: s.notificationId,
            userId,
            channel: channel.id,
            status: channel.id === "in_app" ? "delivered" : "pending",
            deliveredAt: channel.id === "in_app" ? sentAt : null,
          })
          .run();
      }
    }
  });

  return toSend.length;
}

/* ------------------------------------------------------------------ */
/* In-app inbox                                                        */
/* ------------------------------------------------------------------ */

export function listInbox(userId: string, limit = 50): NotificationView[] {
  return getDb()
    .select()
    .from(schema.reminderNotifications)
    .where(
      and(
        eq(schema.reminderNotifications.userId, userId),
        eq(schema.reminderNotifications.status, "sent"),
      ),
    )
    .orderBy(desc(schema.reminderNotifications.sentAt))
    .limit(limit)
    .all()
    .map((n) => ({
      id: n.id,
      reminderId: n.reminderId,
      kind: n.kind,
      offsetDays: n.offsetDays,
      scheduledFor: n.scheduledFor,
      status: n.status,
      title: n.title,
      body: n.body,
      sentAt: n.sentAt?.getTime() ?? null,
      readAt: n.readAt?.getTime() ?? null,
    }));
}

export function unreadCount(userId: string): number {
  const row = getDb()
    .select({ n: count() })
    .from(schema.reminderNotifications)
    .where(
      and(
        eq(schema.reminderNotifications.userId, userId),
        eq(schema.reminderNotifications.status, "sent"),
        isNull(schema.reminderNotifications.readAt),
      ),
    )
    .get();
  return row?.n ?? 0;
}

export function markRead(userId: string, ids: string[] | "all"): void {
  const db = getDb();
  const base = and(
    eq(schema.reminderNotifications.userId, userId),
    isNull(schema.reminderNotifications.readAt),
  );
  db.update(schema.reminderNotifications)
    .set({ readAt: new Date() })
    .where(
      ids === "all" ? base : and(base, inArray(schema.reminderNotifications.id, ids.slice(0, 200))),
    )
    .run();
}

/* ------------------------------------------------------------------ */
/* Browser channel                                                     */
/* ------------------------------------------------------------------ */

export function pendingBrowserDeliveries(userId: string) {
  return getDb()
    .select({
      deliveryId: schema.notificationDeliveries.id,
      notificationId: schema.reminderNotifications.id,
      reminderId: schema.reminderNotifications.reminderId,
      title: schema.reminderNotifications.title,
      body: schema.reminderNotifications.body,
    })
    .from(schema.notificationDeliveries)
    .innerJoin(
      schema.reminderNotifications,
      eq(schema.reminderNotifications.id, schema.notificationDeliveries.notificationId),
    )
    .innerJoin(schema.reminders,eq(schema.reminders.id,schema.reminderNotifications.reminderId))
    .innerJoin(schema.spaces,eq(schema.spaces.id,schema.reminders.spaceId))
    .where(
      and(
        eq(schema.spaces.status,"active"),
        eq(schema.notificationDeliveries.userId, userId),
        eq(schema.notificationDeliveries.channel, "browser"),
        eq(schema.notificationDeliveries.status, "pending"),
      ),
    )
    .limit(5)
    .all();
}

export function ackBrowserDeliveries(userId: string, deliveryIds: string[]): void {
  if (deliveryIds.length === 0) return;
  getDb()
    .update(schema.notificationDeliveries)
    .set({ status: "delivered", deliveredAt: new Date() })
    .where(
      and(
        eq(schema.notificationDeliveries.userId, userId),
        inArray(schema.notificationDeliveries.id, deliveryIds.slice(0, 50)),
      ),
    )
    .run();
}
