import { getSpace } from "./spaces";
import "server-only";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb, schema, type DB } from "@/lib/db";
import type { SpaceView } from "@/lib/types";
import type { Category, ReminderRow } from "@/lib/db/schema";
import {
  addDays,
  addMonths,
  addYears,
  diffDays,
  formatLong,
  formatMedium,
  type ISODate,
} from "@/lib/dates";
import {
  normalizeOffsets,
  recurrenceLabel,
  type Lifecycle,
  type Recurrence,
  type ReminderType,
} from "@/lib/domain";
import { planNotifications } from "@/lib/notifications/schedule";
import { matchesText } from "@/lib/search";
import { computeStatus } from "@/lib/status";
import { storage } from "@/lib/storage";
import type {
  CategoryView,
  ReminderDetail,
  ReminderView,
  SettingsView,
} from "@/lib/types";
import type { ReminderInput } from "@/lib/validation";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type Conn = DB | Tx;

export class NotFoundError extends Error {
  constructor(message = "Reminder not found") {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Account setup & settings                                            */
/* ------------------------------------------------------------------ */

export function ensureUserSetup(userId: string, conn: Conn = getDb()): void {
  conn.insert(schema.userSettings).values({ userId }).onConflictDoNothing().run();

}

export function getSettings(userId: string): SettingsView {
  const db = getDb();
  let row = db
    .select()
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .get();
  if (!row) {
    ensureUserSetup(userId);
    row = db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .get()!;
  }
  return {
    defaultOffsets: parseOffsets(row.defaultOffsets),
    notificationLevel: row.notificationLevel,
    inAppEnabled: row.inAppEnabled,
    browserEnabled: row.browserEnabled,
    emailEnabled: row.emailEnabled,
    pushEnabled: row.pushEnabled,
    dayFirst: row.dayFirst,
  };
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

function toCategoryView(c: Category): CategoryView {
  return {
    spaceId: c.spaceId,
    id: c.id,
    name: c.name,
    slug: c.slug,
    color: c.color,
    icon: c.icon,
    isDefault: c.isDefault,
  };
}

export function listCategories(userId: string, spaceId?: string): CategoryView[] {
  return getDb()
    .select()
    .from(schema.categories)
    .where(and(eq(schema.categories.userId, userId), spaceId ? eq(schema.categories.spaceId,spaceId) : undefined))
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name))
    .all()
    .map(toCategoryView);
}

function assertCategory(conn: Conn, userId: string, categoryId: string | null, spaceId: string): string | null {
  if (!categoryId) return null;
  const c = conn
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(and(eq(schema.categories.id, categoryId), eq(schema.categories.userId, userId), eq(schema.categories.spaceId,spaceId)))
    .get();
  if (!c) throw new NotFoundError("Category not found");
  return c.id;
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

function parseOffsets(json: string): number[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? normalizeOffsets(v.map(Number)) : [];
  } catch {
    return [];
  }
}

function recurrenceOf(r: ReminderRow): Recurrence | null {
  return r.recurrenceUnit && r.recurrenceInterval
    ? { unit: r.recurrenceUnit, interval: r.recurrenceInterval }
    : null;
}

function toView(
  r: ReminderRow,
  category: CategoryView | null,
  today: ISODate,
  nextNotificationDate: ISODate | null,
  space?: SpaceView,
): ReminderView {
  return {
    spaceId: r.spaceId,
    space: space ?? getSpace(r.userId, r.spaceId),
    id: r.id,
    seriesId: r.seriesId,
    cycle: r.cycle,
    title: r.title,
    description: r.description,
    importantDate: r.importantDate,
    category,
    reminderType: r.reminderType as ReminderType,
    associatedWith: r.associatedWith,
    lifecycle: r.status,
    status: computeStatus(
      { lifecycle: r.status, importantDate: r.importantDate, priority: r.priority },
      today,
    ),
    priority: r.priority,
    recurrence: recurrenceOf(r),
    offsets: parseOffsets(r.notifyOffsets),
    snoozedUntil: r.snoozedUntil && r.snoozedUntil > today ? r.snoozedUntil : null,
    daysRemaining: diffDays(today, r.importantDate),
    nextNotificationDate,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
    resolvedAt: r.resolvedAt?.getTime() ?? null,
    renewedAt: r.renewedAt?.getTime() ?? null,
    archivedAt: r.archivedAt?.getTime() ?? null,
  };
}

/** Next pending notification date for each reminder, in one query. */
function nextNotificationMap(conn: Conn, userId: string, today: ISODate): Map<string, ISODate> {
  const rows = conn
    .select({
      reminderId: schema.reminderNotifications.reminderId,
      scheduledFor: schema.reminderNotifications.scheduledFor,
    })
    .from(schema.reminderNotifications)
    .where(
      and(
        eq(schema.reminderNotifications.userId, userId),
        eq(schema.reminderNotifications.status, "pending"),
      ),
    )
    .all();
  const map = new Map<string, ISODate>();
  for (const row of rows) {
    if (row.scheduledFor < today) continue;
    const cur = map.get(row.reminderId);
    if (!cur || row.scheduledFor < cur) map.set(row.reminderId, row.scheduledFor);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function listReminders(
  userId: string,
  today: ISODate,
  opts: { lifecycles?: Lifecycle[]; spaceId?: string; includeArchivedSpaces?: boolean } = {},
): ReminderView[] {
  const db = getDb();
  const cats = new Map(listCategories(userId).map((c) => [c.id, c]));
  const where = opts.lifecycles?.length
    ? and(eq(schema.reminders.userId, userId), inArray(schema.reminders.status, opts.lifecycles))
    : eq(schema.reminders.userId, userId);
  const rows = db
    .select()
    .from(schema.reminders)
    .where(where)
    .orderBy(asc(schema.reminders.importantDate))
    .all();
  const next = nextNotificationMap(db, userId, today);
  const spaces = new Map(db.select().from(schema.spaces).where(eq(schema.spaces.userId,userId)).all().map(s=>[s.id,s]));
  return rows.filter(r => (!opts.spaceId || r.spaceId === opts.spaceId) && (opts.includeArchivedSpaces || spaces.get(r.spaceId)?.status === "active")).map((r) =>
    toView(r, r.categoryId ? (cats.get(r.categoryId) ?? null) : null, today, next.get(r.id) ?? null, spaces.get(r.spaceId)),
  );
}

function getRow(conn: Conn, userId: string, id: string): ReminderRow {
  const row = conn
    .select()
    .from(schema.reminders)
    .where(and(eq(schema.reminders.id, id), eq(schema.reminders.userId, userId)))
    .get();
  if (!row) throw new NotFoundError();
  return row;
}

export function getReminderDetail(userId: string, id: string, today: ISODate): ReminderDetail {
  const db = getDb();
  const row = getRow(db, userId, id);
  const cat = row.categoryId
    ? db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, row.categoryId))
        .get()
    : undefined;

  const notifications = db
    .select()
    .from(schema.reminderNotifications)
    .where(eq(schema.reminderNotifications.reminderId, id))
    .orderBy(asc(schema.reminderNotifications.scheduledFor))
    .all();
  const nextPending =
    notifications.find((n) => n.status === "pending" && n.scheduledFor >= today)?.scheduledFor ??
    null;

  const attachments = db
    .select()
    .from(schema.attachments)
    .where(and(eq(schema.attachments.reminderId, id), eq(schema.attachments.userId, userId)))
    .orderBy(desc(schema.attachments.createdAt))
    .all();

  const renewals = db
    .select()
    .from(schema.renewals)
    .where(and(eq(schema.renewals.seriesId, row.seriesId), eq(schema.renewals.userId, userId)))
    .orderBy(desc(schema.renewals.renewedAt))
    .all();

  const history = db
    .select()
    .from(schema.reminderHistory)
    .where(
      and(
        eq(schema.reminderHistory.seriesId, row.seriesId),
        eq(schema.reminderHistory.userId, userId),
      ),
    )
    .orderBy(desc(schema.reminderHistory.createdAt))
    .limit(100)
    .all();

  const periods = db
    .select({
      id: schema.reminders.id,
      cycle: schema.reminders.cycle,
      importantDate: schema.reminders.importantDate,
      lifecycle: schema.reminders.status,
    })
    .from(schema.reminders)
    .where(and(eq(schema.reminders.seriesId, row.seriesId), eq(schema.reminders.userId, userId)))
    .orderBy(desc(schema.reminders.cycle))
    .all();

  return {
    reminder: toView(row, cat ? toCategoryView(cat) : null, today, nextPending),
    notifications: notifications.map((n) => ({
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
    })),
    attachments: attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.getTime(),
    })),
    renewals: renewals.map((r) => ({
      id: r.id,
      kind: r.kind,
      fromReminderId: r.fromReminderId,
      toReminderId: r.toReminderId,
      previousDate: r.previousDate,
      newDate: r.newDate,
      note: r.note,
      renewedAt: r.renewedAt.getTime(),
    })),
    history: history.map((h) => ({
      id: h.id,
      reminderId: h.reminderId,
      event: h.event,
      detail: h.detail,
      createdAt: h.createdAt.getTime(),
    })),
    periods,
  };
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export function searchReminders(userId: string, query: string, today: ISODate): ReminderView[] {
  const q = query.trim();
  if (!q) return [];
  return listReminders(userId, today)
    .filter((r) => matchesText(r, q))
    .sort((a, b) => {
      // Active first, then nearest date.
      const aa = a.lifecycle === "active" ? 0 : 1;
      const bb = b.lifecycle === "active" ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return Math.abs(a.daysRemaining) - Math.abs(b.daysRemaining);
    })
    .slice(0, 50);
}

/* ------------------------------------------------------------------ */
/* History & notifications helpers                                     */
/* ------------------------------------------------------------------ */

function logHistory(
  conn: Conn,
  r: Pick<ReminderRow, "id" | "userId" | "seriesId">,
  event: string,
  detail?: string | null,
): void {
  conn
    .insert(schema.reminderHistory)
    .values({
      reminderId: r.id,
      userId: r.userId,
      seriesId: r.seriesId,
      event,
      detail: detail ?? null,
    })
    .run();
}

/** Drop unsent notifications so they can be re-planned (or so nothing fires). */
function cancelPending(conn: Conn, reminderId: string): void {
  conn
    .update(schema.reminderNotifications)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(schema.reminderNotifications.reminderId, reminderId),
        eq(schema.reminderNotifications.status, "pending"),
      ),
    )
    .run();
}

/** (Re)generate notification records for a reminder from its offsets. */
function scheduleNotifications(conn: Conn, r: ReminderRow, today: ISODate): void {
  cancelPending(conn, r.id);
  // Purge cancelled advance rows so the table doesn't grow on every edit.
  conn
    .delete(schema.reminderNotifications)
    .where(
      and(
        eq(schema.reminderNotifications.reminderId, r.id),
        eq(schema.reminderNotifications.status, "cancelled"),
      ),
    )
    .run();
  if (r.status !== "active") return;
  const planned = planNotifications(r.importantDate, parseOffsets(r.notifyOffsets), today);
  if (planned.length === 0) return;
  conn
    .insert(schema.reminderNotifications)
    .values(
      planned.map((p) => ({
        reminderId: r.id,
        userId: r.userId,
        kind: p.kind,
        offsetDays: p.offsetDays,
        scheduledFor: p.scheduledFor,
      })),
    )
    .run();
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

function rowValuesFromInput(input: ReminderInput) {
  return {
    spaceId: input.spaceId,
    title: input.title,
    description: input.description,
    importantDate: input.importantDate,
    reminderType: input.reminderType,
    associatedWith: input.associatedWith,
    priority: input.priority,
    recurrenceUnit: input.recurrence?.unit ?? null,
    recurrenceInterval: input.recurrence?.interval ?? null,
    notifyOffsets: JSON.stringify(normalizeOffsets(input.offsets)),
  };
}

export function createReminder(
  userId: string,
  input: ReminderInput,
  today: ISODate,
  source: "manual" | "quick_capture" = "manual",
): string {
  const db = getDb();
  return db.transaction((tx) => {
    if (getSpace(userId, input.spaceId).status !== "active") throw new Error("Choose an active Minder Space.");
    const categoryId = assertCategory(tx, userId, input.categoryId, input.spaceId);
    const id = crypto.randomUUID();
    const row = tx
      .insert(schema.reminders)
      .values({
        id,
        userId,
        seriesId: id,
        categoryId,
        ...rowValuesFromInput(input),
      })
      .returning()
      .get();
    scheduleNotifications(tx, row, today);
    logHistory(
      tx,
      row,
      "created",
      `${source === "quick_capture" ? "Captured" : "Added"} for ${formatLong(row.importantDate)}`,
    );
    return id;
  });
}

export function updateReminder(
  userId: string,
  id: string,
  input: ReminderInput,
  today: ISODate,
): void {
  const db = getDb();
  db.transaction((tx) => {
    const before = getRow(tx, userId, id);
    if (getSpace(userId, input.spaceId).status !== "active") throw new Error("Choose an active Minder Space.");
    const categoryId = assertCategory(tx, userId, input.categoryId, input.spaceId);
    const values = rowValuesFromInput(input);
    const after = tx
      .update(schema.reminders)
      .set({ ...values, categoryId, updatedAt: new Date() })
      .where(eq(schema.reminders.id, id))
      .returning()
      .get();

    const changes: string[] = [];
    if (before.title !== after.title) changes.push("title");
    if (before.importantDate !== after.importantDate)
      changes.push(
        `date ${formatMedium(before.importantDate)} → ${formatMedium(after.importantDate)}`,
      );
    if (before.categoryId !== after.categoryId) changes.push("category");
    if (before.reminderType !== after.reminderType) changes.push("type");
    if (before.notifyOffsets !== after.notifyOffsets) changes.push("reminder timing");
    if (
      before.recurrenceUnit !== after.recurrenceUnit ||
      before.recurrenceInterval !== after.recurrenceInterval
    )
      changes.push(`repeat: ${recurrenceLabel(recurrenceOf(after))}`);
    if (before.associatedWith !== after.associatedWith) changes.push("who/what");
    if (before.description !== after.description) changes.push("notes");
    if (before.priority !== after.priority) changes.push(`priority ${after.priority}`);

    if (
      before.importantDate !== after.importantDate ||
      before.notifyOffsets !== after.notifyOffsets
    ) {
      scheduleNotifications(tx, after, today);
    }
    if (changes.length) logHistory(tx, after, "updated", `Changed ${changes.join(", ")}`);
  });
}

export function snoozeReminder(userId: string, id: string, until: ISODate, today: ISODate): void {
  if (until <= today) throw new Error("Snooze until a future date.");
  const db = getDb();
  db.transaction((tx) => {
    const r = getRow(tx, userId, id);
    if (r.status !== "active") throw new Error("Only active reminders can be snoozed.");
    // The important date never moves — only notifications are held back.
    tx.update(schema.reminders)
      .set({ snoozedUntil: until, updatedAt: new Date() })
      .where(eq(schema.reminders.id, id))
      .run();
    // Anything already due right now is quietened.
    tx.update(schema.reminderNotifications)
      .set({ status: "skipped" })
      .where(
        and(
          eq(schema.reminderNotifications.reminderId, id),
          eq(schema.reminderNotifications.status, "pending"),
          ne(schema.reminderNotifications.kind, "snooze"),
        ),
      )
      .run();
    // ...and future ones that fall inside the snooze window are skipped later.
    tx.delete(schema.reminderNotifications)
      .where(
        and(
          eq(schema.reminderNotifications.reminderId, id),
          eq(schema.reminderNotifications.kind, "snooze"),
          eq(schema.reminderNotifications.status, "pending"),
        ),
      )
      .run();
    tx.insert(schema.reminderNotifications)
      .values({ reminderId: id, userId, kind: "snooze", scheduledFor: until })
      .run();
    // Restore future advance notifications after the snooze window.
    const planned = planNotifications(r.importantDate, parseOffsets(r.notifyOffsets), today).filter(
      (p) => p.scheduledFor > until,
    );
    if (planned.length) {
      tx.insert(schema.reminderNotifications)
        .values(
          planned.map((p) => ({
            reminderId: id,
            userId,
            kind: p.kind,
            offsetDays: p.offsetDays,
            scheduledFor: p.scheduledFor,
          })),
        )
        .run();
    }
    logHistory(tx, r, "snoozed", `Notifications paused until ${formatLong(until)}`);
  });
}

export function unsnoozeReminder(userId: string, id: string, today: ISODate): void {
  const db = getDb();
  db.transaction((tx) => {
    const r = getRow(tx, userId, id);
    const updated = tx
      .update(schema.reminders)
      .set({ snoozedUntil: null, updatedAt: new Date() })
      .where(eq(schema.reminders.id, id))
      .returning()
      .get();
    scheduleNotifications(tx, updated, today);
    logHistory(tx, r, "unsnoozed", "Snooze cancelled");
  });
}

function nextOccurrence(date: ISODate, rec: Recurrence): ISODate {
  switch (rec.unit) {
    case "day":
      return addDays(date, rec.interval);
    case "week":
      return addDays(date, rec.interval * 7);
    case "month":
      return addMonths(date, rec.interval);
    case "year":
      return addYears(date, rec.interval);
  }
}

/** Suggested next date when renewing (recurrence interval, else +1 year). */
export function suggestedRenewalDate(r: Pick<ReminderView, "importantDate" | "recurrence">): ISODate {
  return nextOccurrence(r.importantDate, r.recurrence ?? { unit: "year", interval: 1 });
}

/**
 * Open the next period of a series: the old reminder is closed (renewed or
 * resolved) and preserved; a new reminder carries the details forward.
 */
function openNextPeriod(
  tx: Tx,
  old: ReminderRow,
  newDate: ISODate,
  kind: "renewal" | "recurrence",
  note: string | null,
  today: ISODate,
): string {
  const now = new Date();
  tx.update(schema.reminders)
    .set(
      kind === "renewal"
        ? { status: "renewed", renewedAt: now, snoozedUntil: null, updatedAt: now }
        : { status: "resolved", resolvedAt: now, snoozedUntil: null, updatedAt: now },
    )
    .where(eq(schema.reminders.id, old.id))
    .run();
  cancelPending(tx, old.id);

  const newId = crypto.randomUUID();
  const next = tx
    .insert(schema.reminders)
    .values({
      id: newId,
      userId: old.userId,
      spaceId: old.spaceId,
      seriesId: old.seriesId,
      previousReminderId: old.id,
      cycle: old.cycle + 1,
      title: old.title,
      description: old.description,
      importantDate: newDate,
      categoryId: old.categoryId,
      reminderType: old.reminderType,
      associatedWith: old.associatedWith,
      priority: old.priority,
      recurrenceUnit: old.recurrenceUnit,
      recurrenceInterval: old.recurrenceInterval,
      notifyOffsets: old.notifyOffsets,
    })
    .returning()
    .get();
  scheduleNotifications(tx, next, today);

  tx.insert(schema.renewals)
    .values({
      userId: old.userId,
      seriesId: old.seriesId,
      fromReminderId: old.id,
      toReminderId: newId,
      kind,
      previousDate: old.importantDate,
      newDate,
      note,
    })
    .run();

  if (kind === "renewal") {
    logHistory(
      tx,
      old,
      "renewed",
      `Renewed: ${formatLong(old.importantDate)} → ${formatLong(newDate)}${note ? ` · ${note}` : ""}`,
    );
    logHistory(tx, next, "created", `New period starting after renewal, due ${formatLong(newDate)}`);
  } else {
    logHistory(tx, old, "resolved", `Done for ${formatLong(old.importantDate)}`);
    logHistory(tx, next, "created", `Next occurrence scheduled for ${formatLong(newDate)}`);
  }
  return newId;
}

export function renewReminder(
  userId: string,
  id: string,
  newDate: ISODate,
  note: string | null,
  today: ISODate,
): string {
  const db = getDb();
  return db.transaction((tx) => {
    const old = getRow(tx, userId, id);
    if (old.status !== "active") throw new Error("Only active reminders can be renewed.");
    if (newDate <= old.importantDate)
      throw new Error("The new date must be after the current date.");
    return openNextPeriod(tx, old, newDate, "renewal", note, today);
  });
}

/** Mark resolved. Recurring reminders roll forward to the next occurrence. */
export function resolveReminder(
  userId: string,
  id: string,
  today: ISODate,
): { nextId: string | null } {
  const db = getDb();
  return db.transaction((tx) => {
    const r = getRow(tx, userId, id);
    if (r.status !== "active") throw new Error("This reminder is not active.");
    const rec = recurrenceOf(r);
    if (rec) {
      let next = nextOccurrence(r.importantDate, rec);
      // Skip occurrences already in the past if it was resolved very late.
      let guard = 0;
      while (next < today && guard++ < 500) next = nextOccurrence(next, rec);
      return { nextId: openNextPeriod(tx, r, next, "recurrence", null, today) };
    }
    const now = new Date();
    tx.update(schema.reminders)
      .set({ status: "resolved", resolvedAt: now, snoozedUntil: null, updatedAt: now })
      .where(eq(schema.reminders.id, id))
      .run();
    cancelPending(tx, id);
    logHistory(tx, r, "resolved", "Marked as resolved");
    return { nextId: null };
  });
}

export function reopenReminder(userId: string, id: string, today: ISODate): void {
  const db = getDb();
  db.transaction((tx) => {
    const r = getRow(tx, userId, id);
    if (r.status !== "resolved") throw new Error("Only resolved reminders can be reopened.");
    const updated = tx
      .update(schema.reminders)
      .set({ status: "active", resolvedAt: null, updatedAt: new Date() })
      .where(eq(schema.reminders.id, id))
      .returning()
      .get();
    scheduleNotifications(tx, updated, today);
    logHistory(tx, r, "reopened", "Reopened");
  });
}

export function archiveReminder(userId: string, id: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const r = getRow(tx, userId, id);
    if (r.status === "archived") return;
    const now = new Date();
    tx.update(schema.reminders)
      .set({
        status: "archived",
        statusBeforeArchive: r.status,
        archivedAt: now,
        snoozedUntil: null,
        updatedAt: now,
      })
      .where(eq(schema.reminders.id, id))
      .run();
    cancelPending(tx, id);
    logHistory(tx, r, "archived", "Moved to archive");
  });
}

export function unarchiveReminder(userId: string, id: string, today: ISODate): void {
  const db = getDb();
  db.transaction((tx) => {
    const r = getRow(tx, userId, id);
    if (r.status !== "archived") return;
    const restored = (r.statusBeforeArchive as Lifecycle | null) ?? "active";
    const updated = tx
      .update(schema.reminders)
      .set({
        status: restored === "archived" ? "active" : restored,
        statusBeforeArchive: null,
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.reminders.id, id))
      .returning()
      .get();
    scheduleNotifications(tx, updated, today);
    logHistory(tx, r, "restored", "Restored from archive");
  });
}

export async function deleteReminder(userId: string, id: string): Promise<void> {
  const db = getDb();
  const r = getRow(db, userId, id);
  const files = db
    .select({ key: schema.attachments.storageKey })
    .from(schema.attachments)
    .where(eq(schema.attachments.reminderId, id))
    .all();
  db.transaction((tx) => {
    // Keep the rest of the series intact: re-point renewals' links by deleting
    // only the rows that reference this period.
    tx.delete(schema.renewals)
      .where(
        and(
          eq(schema.renewals.userId, userId),
          inArray(schema.renewals.fromReminderId, [r.id]),
        ),
      )
      .run();
    tx.delete(schema.renewals)
      .where(
        and(eq(schema.renewals.userId, userId), inArray(schema.renewals.toReminderId, [r.id])),
      )
      .run();
    tx.update(schema.reminders)
      .set({ previousReminderId: r.previousReminderId })
      .where(eq(schema.reminders.previousReminderId, r.id))
      .run();
    tx.delete(schema.reminders).where(eq(schema.reminders.id, r.id)).run();
  });
  await Promise.all(files.map((f) => storage.remove(f.key).catch(() => undefined)));
}

/* ------------------------------------------------------------------ */
/* Attachments                                                         */
/* ------------------------------------------------------------------ */

export async function addAttachment(
  userId: string,
  reminderId: string,
  file: { name: string; type: string; data: Buffer },
): Promise<string> {
  const db = getDb();
  const r = getRow(db, userId, reminderId);
  const id = crypto.randomUUID();
  const key = `${userId}/${reminderId}/${id}`;
  await storage.save(key, file.data);
  try {
    db.transaction((tx) => {
      tx.insert(schema.attachments)
        .values({
          id,
          reminderId,
          userId,
          fileName: file.name.slice(0, 200),
          mimeType: file.type,
          sizeBytes: file.data.length,
          storageKey: key,
        })
        .run();
      logHistory(tx, r, "attachment_added", file.name.slice(0, 200));
    });
  } catch (e) {
    await storage.remove(key).catch(() => undefined);
    throw e;
  }
  return id;
}

export function getAttachment(userId: string, attachmentId: string) {
  return getDb()
    .select()
    .from(schema.attachments)
    .where(and(eq(schema.attachments.id, attachmentId), eq(schema.attachments.userId, userId)))
    .get();
}

export async function deleteAttachment(userId: string, attachmentId: string): Promise<string> {
  const db = getDb();
  const a = getAttachment(userId, attachmentId);
  if (!a) throw new NotFoundError("Attachment not found");
  const r = getRow(db, userId, a.reminderId);
  db.transaction((tx) => {
    tx.delete(schema.attachments).where(eq(schema.attachments.id, a.id)).run();
    logHistory(tx, r, "attachment_removed", a.fileName);
  });
  await storage.remove(a.storageKey).catch(() => undefined);
  return a.reminderId;
}
