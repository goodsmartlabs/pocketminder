import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * PocketMinder data model.
 *
 * - A reminder is one *period* of something to remember (e.g. one validity
 *   period of a passport). Renewing or completing a recurring reminder closes
 *   that period and opens a new reminder in the same `seriesId`, so the full
 *   history is preserved.
 * - Advance notifications are rows in `reminder_notifications`, generated from
 *   the reminder's `notifyOffsets`, rather than dates hard-coded on the reminder.
 * - Each notification fans out to channels via `notification_deliveries`
 *   (in-app and browser today; email/push slot in later).
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 of the session token; the raw token only lives in the cookie. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** JSON array of day offsets used as the default schedule for new reminders. */
  defaultOffsets: text("default_offsets").notNull().default("[90,60,30,14,7,1,0]"),
  notificationLevel: text("notification_level", { enum: ["all", "key", "minimal"] })
    .notNull()
    .default("all"),
  inAppEnabled: integer("in_app_enabled", { mode: "boolean" }).notNull().default(true),
  browserEnabled: integer("browser_enabled", { mode: "boolean" }).notNull().default(false),
  emailEnabled: integer("email_enabled", { mode: "boolean" }).notNull().default(false),
  pushEnabled: integer("push_enabled", { mode: "boolean" }).notNull().default(false),
  /** Interpret 03/04 as 3 April. */
  dayFirst: integer("day_first", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const categories = sqliteTable(
  "categories",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    color: text("color").notNull(),
    icon: text("icon").notNull().default("tag"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("categories_user_slug_idx").on(t.userId, t.slug)],
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Groups every period/cycle of the same thing (renewals, recurrences). */
    seriesId: text("series_id").notNull(),
    previousReminderId: text("previous_reminder_id"),
    cycle: integer("cycle").notNull().default(1),
    title: text("title").notNull(),
    description: text("description"),
    importantDate: text("important_date").notNull(), // YYYY-MM-DD
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    reminderType: text("reminder_type").notNull().default("custom"),
    associatedWith: text("associated_with"),
    /** Lifecycle; urgency (safe/upcoming/urgent/...) is derived from the date. */
    status: text("status", { enum: ["active", "resolved", "renewed", "archived"] })
      .notNull()
      .default("active"),
    /** Lifecycle before archiving, so un-archiving restores it. */
    statusBeforeArchive: text("status_before_archive"),
    priority: text("priority", { enum: ["low", "normal", "high", "critical"] })
      .notNull()
      .default("normal"),
    recurrenceUnit: text("recurrence_unit", { enum: ["day", "week", "month", "year"] }),
    recurrenceInterval: integer("recurrence_interval"),
    /** JSON array of day offsets, e.g. [90,60,30,7,1,0]. */
    notifyOffsets: text("notify_offsets").notNull().default("[]"),
    /** Notifications are held until this date. Never changes importantDate. */
    snoozedUntil: text("snoozed_until"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    renewedAt: integer("renewed_at", { mode: "timestamp_ms" }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("reminders_user_date_idx").on(t.userId, t.importantDate),
    index("reminders_user_status_idx").on(t.userId, t.status),
    index("reminders_series_idx").on(t.seriesId),
  ],
);

export const reminderNotifications = sqliteTable(
  "reminder_notifications",
  {
    id: id(),
    reminderId: text("reminder_id")
      .notNull()
      .references(() => reminders.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["advance", "due", "overdue", "snooze"] }).notNull(),
    offsetDays: integer("offset_days"),
    scheduledFor: text("scheduled_for").notNull(), // YYYY-MM-DD
    status: text("status", { enum: ["pending", "sent", "skipped", "cancelled"] })
      .notNull()
      .default("pending"),
    title: text("title"),
    body: text("body"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_status_idx").on(t.userId, t.status, t.scheduledFor),
    index("notifications_reminder_idx").on(t.reminderId),
  ],
);

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    id: id(),
    notificationId: text("notification_id")
      .notNull()
      .references(() => reminderNotifications.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["in_app", "browser", "email", "push"] }).notNull(),
    status: text("status", { enum: ["pending", "delivered", "failed"] })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("deliveries_user_channel_idx").on(t.userId, t.channel, t.status)],
);

export const reminderHistory = sqliteTable(
  "reminder_history",
  {
    id: id(),
    reminderId: text("reminder_id")
      .notNull()
      .references(() => reminders.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seriesId: text("series_id").notNull(),
    event: text("event").notNull(),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("history_series_idx").on(t.seriesId, t.createdAt)],
);

export const renewals = sqliteTable(
  "renewals",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seriesId: text("series_id").notNull(),
    fromReminderId: text("from_reminder_id")
      .notNull()
      .references(() => reminders.id, { onDelete: "cascade" }),
    toReminderId: text("to_reminder_id")
      .notNull()
      .references(() => reminders.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["renewal", "recurrence"] })
      .notNull()
      .default("renewal"),
    previousDate: text("previous_date").notNull(),
    newDate: text("new_date").notNull(),
    note: text("note"),
    renewedAt: createdAt(),
  },
  (t) => [index("renewals_series_idx").on(t.seriesId)],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: id(),
    reminderId: text("reminder_id")
      .notNull()
      .references(() => reminders.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_reminder_idx").on(t.reminderId)],
);

export const remindersRelations = relations(reminders, ({ one, many }) => ({
  category: one(categories, { fields: [reminders.categoryId], references: [categories.id] }),
  notifications: many(reminderNotifications),
  attachments: many(attachments),
}));

export type User = typeof users.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type ReminderRow = typeof reminders.$inferSelect;
export type NewReminderRow = typeof reminders.$inferInsert;
export type NotificationRow = typeof reminderNotifications.$inferSelect;
export type AttachmentRow = typeof attachments.$inferSelect;
export type RenewalRow = typeof renewals.$inferSelect;
export type HistoryRow = typeof reminderHistory.$inferSelect;
