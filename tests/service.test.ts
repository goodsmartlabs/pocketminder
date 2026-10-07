import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-test-"));
process.env.POCKETMINDER_DATA_DIR = dir;

type Svc = typeof import("@/server/reminders");
type Notif = typeof import("@/server/notifications");
let svc: Svc;
let notif: Notif;
let userId: string;

beforeAll(async () => {
  svc = await import("@/server/reminders");
  notif = await import("@/server/notifications");
  const { getDb, schema } = await import("@/lib/db");
  userId = getDb()
    .insert(schema.users)
    .values({ email: "t@example.com", name: "Test", passwordHash: "x", timezone: "UTC" })
    .returning()
    .get().id;
  svc.ensureUserSetup(userId);
});

const input = (over: Record<string, unknown> = {}) => ({
  title: "Visa",
  importantDate: "2026-11-14",
  categoryId: null,
  reminderType: "expiry" as const,
  associatedWith: "John",
  description: null,
  priority: "normal" as const,
  offsets: [30, 7, 0],
  recurrence: null,
  ...over,
});

describe("reminder lifecycle", () => {
  it("creates notification records from offsets", () => {
    const id = svc.createReminder(userId, input(), "2026-10-07");
    const d = svc.getReminderDetail(userId, id, "2026-10-07");
    expect(d.notifications.map((n) => n.scheduledFor)).toEqual([
      "2026-10-15",
      "2026-11-07",
      "2026-11-14",
    ]);
    expect(d.reminder.nextNotificationDate).toBe("2026-10-15");
    expect(d.reminder.daysRemaining).toBe(38);
  });

  it("renews: preserves the old period and opens a new one", () => {
    const id = svc.createReminder(userId, input({ title: "Passport" }), "2026-10-07");
    const next = svc.renewReminder(userId, id, "2036-11-14", "new book", "2026-10-07");
    const old = svc.getReminderDetail(userId, id, "2026-10-07");
    const cur = svc.getReminderDetail(userId, next, "2026-10-07");
    expect(old.reminder.lifecycle).toBe("renewed");
    expect(old.notifications.every((n) => n.status !== "pending")).toBe(true);
    expect(cur.reminder).toMatchObject({ lifecycle: "active", cycle: 2, importantDate: "2036-11-14" });
    expect(cur.renewals[0]).toMatchObject({ previousDate: "2026-11-14", newDate: "2036-11-14", note: "new book" });
    expect(cur.periods).toHaveLength(2);
    expect(() => svc.renewReminder(userId, next, "2030-01-01", null, "2026-10-07")).toThrow();
  });

  it("rolls a recurring reminder forward when resolved", () => {
    const id = svc.createReminder(
      userId,
      input({ title: "Rent", importantDate: "2026-10-09", reminderType: "payment", recurrence: { unit: "month", interval: 1 } }),
      "2026-10-07",
    );
    const { nextId } = svc.resolveReminder(userId, id, "2026-10-07");
    expect(nextId).toBeTruthy();
    expect(svc.getReminderDetail(userId, nextId!, "2026-10-07").reminder.importantDate).toBe("2026-11-09");
  });

  it("snoozing never changes the important date", () => {
    const id = svc.createReminder(userId, input({ title: "Licence", importantDate: "2026-10-10" }), "2026-10-07");
    svc.snoozeReminder(userId, id, "2026-10-09", "2026-10-07");
    const d = svc.getReminderDetail(userId, id, "2026-10-07");
    expect(d.reminder.importantDate).toBe("2026-10-10");
    expect(d.reminder.snoozedUntil).toBe("2026-10-09");
    expect(d.notifications.some((n) => n.kind === "snooze" && n.status === "pending")).toBe(true);
  });

  it("sends one notification per reminder and surfaces overdue items", async () => {
    const id = svc.createReminder(userId, input({ title: "Overdue cert", importantDate: "2026-10-20", offsets: [14, 7, 1] }), "2026-10-01");
    // Jump ahead: three notifications are due, only the latest is sent.
    await notif.processDueNotifications(userId, "UTC", { force: true, now: new Date("2026-10-19T12:00:00Z") });
    const sent = svc.getReminderDetail(userId, id, "2026-10-19").notifications.filter((n) => n.status === "sent");
    expect(sent).toHaveLength(1);
    expect(sent[0].offsetDays).toBe(1);

    await notif.processDueNotifications(userId, "UTC", { force: true, now: new Date("2026-10-25T12:00:00Z") });
    const overdue = svc.getReminderDetail(userId, id, "2026-10-25").notifications.filter((n) => n.kind === "overdue");
    expect(overdue).toHaveLength(1);
    // Not again within the week.
    await notif.processDueNotifications(userId, "UTC", { force: true, now: new Date("2026-10-27T12:00:00Z") });
    expect(svc.getReminderDetail(userId, id, "2026-10-27").notifications.filter((n) => n.kind === "overdue")).toHaveLength(1);
  });

  it("scopes reads to the owner", () => {
    const id = svc.createReminder(userId, input(), "2026-10-07");
    expect(() => svc.getReminderDetail("someone-else", id, "2026-10-07")).toThrow(svc.NotFoundError);
  });
});
