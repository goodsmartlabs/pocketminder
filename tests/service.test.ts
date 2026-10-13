import { beforeAll, describe, expect, it } from "vitest";
import { oneRow } from "@/lib/db/first";
import { schema } from "@/lib/db";
import * as svc from "@/server/reminders";
import * as notif from "@/server/notifications";
import * as spaces from "@/server/spaces";
import { freshDb } from "./pg";

let userId: string;
let spaceId: string;

beforeAll(async () => {
  const { db } = await freshDb();
  userId = (
    await db
      .insert(schema.users)
      .values({
        email: "t@example.com",
        name: "Test",
        passwordHash: "x",
        timezone: "UTC",
      })
      .returning()
      .then(oneRow)
  ).id;
  await svc.ensureUserSetup(userId);
  spaceId = await spaces.createSpace(userId, {
    name: "Work",
    icon: "briefcase",
    color: "#48786c",
  });
});

const input = (over: Record<string, unknown> = {}) => ({
  spaceId,
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
  it("creates notification records from offsets", async () => {
    const id = await svc.createReminder(userId, input(), "2026-10-07");
    const d = await svc.getReminderDetail(userId, id, "2026-10-07");
    expect(d.notifications.map((n) => n.scheduledFor)).toEqual([
      "2026-10-15",
      "2026-11-07",
      "2026-11-14",
    ]);
    expect(d.reminder.nextNotificationDate).toBe("2026-10-15");
    expect(d.reminder.daysRemaining).toBe(38);
  });

  it("renews: preserves the old period and opens a new one", async () => {
    const id = await svc.createReminder(
      userId,
      input({ title: "Passport" }),
      "2026-10-07",
    );
    const next = await svc.renewReminder(
      userId,
      id,
      "2036-11-14",
      "new book",
      "2026-10-07",
    );
    const old = await svc.getReminderDetail(userId, id, "2026-10-07");
    const cur = await svc.getReminderDetail(userId, next, "2026-10-07");
    expect(old.reminder.lifecycle).toBe("renewed");
    expect(old.notifications.every((n) => n.status !== "pending")).toBe(true);
    expect(cur.reminder).toMatchObject({
      lifecycle: "active",
      cycle: 2,
      importantDate: "2036-11-14",
    });
    expect(cur.renewals[0]).toMatchObject({
      previousDate: "2026-11-14",
      newDate: "2036-11-14",
      note: "new book",
    });
    expect(cur.periods).toHaveLength(2);
    await expect(
      svc.renewReminder(userId, next, "2030-01-01", null, "2026-10-07"),
    ).rejects.toThrow();
  });

  it("rolls a recurring reminder forward when resolved", async () => {
    const id = await svc.createReminder(
      userId,
      input({
        title: "Rent",
        importantDate: "2026-10-09",
        reminderType: "payment",
        recurrence: { unit: "month", interval: 1 },
      }),
      "2026-10-07",
    );
    const { nextId } = await svc.resolveReminder(userId, id, "2026-10-07");
    expect(nextId).toBeTruthy();
    expect(
      (await svc.getReminderDetail(userId, nextId!, "2026-10-07")).reminder
        .importantDate,
    ).toBe("2026-11-09");
  });

  it("snoozing never changes the important date", async () => {
    const id = await svc.createReminder(
      userId,
      input({ title: "Licence", importantDate: "2026-10-10" }),
      "2026-10-07",
    );
    await svc.snoozeReminder(userId, id, "2026-10-09", "2026-10-07");
    const d = await svc.getReminderDetail(userId, id, "2026-10-07");
    expect(d.reminder.importantDate).toBe("2026-10-10");
    expect(d.reminder.snoozedUntil).toBe("2026-10-09");
    expect(
      d.notifications.some(
        (n) => n.kind === "snooze" && n.status === "pending",
      ),
    ).toBe(true);
  });

  it("sends one notification per reminder and surfaces overdue items", async () => {
    const id = await svc.createReminder(
      userId,
      input({
        title: "Overdue cert",
        importantDate: "2026-10-20",
        offsets: [14, 7, 1],
      }),
      "2026-10-01",
    );
    const notes = async (today: string) =>
      (await svc.getReminderDetail(userId, id, today)).notifications;
    // Jump ahead: three notifications are due, only the latest is sent.
    await notif.processDueNotifications(userId, "UTC", {
      force: true,
      now: new Date("2026-10-19T12:00:00Z"),
    });
    const sent = (await notes("2026-10-19")).filter((n) => n.status === "sent");
    expect(sent).toHaveLength(1);
    expect(sent[0].offsetDays).toBe(1);

    await notif.processDueNotifications(userId, "UTC", {
      force: true,
      now: new Date("2026-10-25T12:00:00Z"),
    });
    expect(
      (await notes("2026-10-25")).filter((n) => n.kind === "overdue"),
    ).toHaveLength(1);
    // Not again within the week.
    await notif.processDueNotifications(userId, "UTC", {
      force: true,
      now: new Date("2026-10-27T12:00:00Z"),
    });
    expect(
      (await notes("2026-10-27")).filter((n) => n.kind === "overdue"),
    ).toHaveLength(1);
    expect(await notif.unreadCount(userId)).toBeGreaterThan(0);
    expect((await notif.listInbox(userId)).length).toBeGreaterThan(0);
  });

  it("scopes reads to the owner", async () => {
    const id = await svc.createReminder(userId, input(), "2026-10-07");
    await expect(
      svc.getReminderDetail("someone-else", id, "2026-10-07"),
    ).rejects.toThrow(svc.NotFoundError);
  });

  it("stores and serves attachments from the database", async () => {
    const id = await svc.createReminder(
      userId,
      input({ title: "Contract" }),
      "2026-10-07",
    );
    const file = {
      name: "contract.pdf",
      type: "application/pdf",
      data: Buffer.from("hello pdf"),
    };
    await svc.addAttachment(userId, id, file);
    const [a] = (await svc.getReminderDetail(userId, id, "2026-10-07"))
      .attachments;
    const row = await svc.getAttachment(userId, a.id);
    const { storage } = await import("@/lib/storage");
    expect(Buffer.from(await storage.read(row!.storageKey)).toString()).toBe(
      "hello pdf",
    );
    await svc.deleteAttachment(userId, a.id);
    expect(
      (await svc.getReminderDetail(userId, id, "2026-10-07")).attachments,
    ).toHaveLength(0);
  });
});

describe("settings", () => {
  it("creates defaults on first read", async () => {
    const s = await svc.getSettings(userId);
    expect(s.defaultOffsets.length).toBeGreaterThan(0);
    expect(s.inAppEnabled).toBe(true);
  });
});

describe("Minder Spaces", () => {
  it("rejects another user's Space and categories from another Space", async () => {
    const { getDb } = await import("@/lib/db");
    const other = await getDb()
      .insert(schema.users)
      .values({ email: "other@example.com", name: "Other", passwordHash: "x" })
      .returning()
      .then(oneRow);
    const foreign = await spaces.createSpace(other.id, { name: "Private" });
    await expect(
      svc.createReminder(userId, input({ spaceId: foreign }), "2026-10-07"),
    ).rejects.toThrow();
    const second = await spaces.createSpace(userId, { name: "Personal" });
    const category = (await svc.listCategories(userId, second))[0];
    await expect(
      svc.createReminder(
        userId,
        input({ categoryId: category.id }),
        "2026-10-07",
      ),
    ).rejects.toThrow();
  });

  it("scopes reads, pauses archived Spaces and preserves renewal history when moved", async () => {
    const source = await spaces.createSpace(userId, { name: "Project" });
    const category = (await svc.listCategories(userId, source))[0];
    const id = await svc.createReminder(
      userId,
      input({ spaceId: source, categoryId: category.id }),
      "2026-10-07",
    );
    const next = await svc.renewReminder(
      userId,
      id,
      "2027-11-14",
      null,
      "2026-10-07",
    );
    expect(
      await svc.listReminders(userId, "2026-10-07", { spaceId: source }),
    ).toHaveLength(2);
    await spaces.archiveSpace(userId, source, true);
    expect(
      await svc.listReminders(userId, "2026-10-07", { spaceId: source }),
    ).toHaveLength(0);
    expect(
      await svc.listReminders(userId, "2026-10-07", {
        spaceId: source,
        includeArchivedSpaces: true,
      }),
    ).toHaveLength(2);
    await expect(
      svc.createReminder(userId, input({ spaceId: source }), "2026-10-07"),
    ).rejects.toThrow();
    await spaces.archiveSpace(userId, source, false);
    await spaces.deleteSpace(userId, source, "move", spaceId);
    const detail = await svc.getReminderDetail(userId, next, "2026-10-07");
    expect(detail.reminder.spaceId).toBe(spaceId);
    expect(detail.renewals).toHaveLength(1);
    expect(detail.periods).toHaveLength(2);
    expect(detail.reminder.category?.spaceId).toBe(spaceId);
    await expect(spaces.getSpace(userId, source)).rejects.toThrow();
  });

  it("permanently deletes only the chosen Space", async () => {
    const source = await spaces.createSpace(userId, { name: "Disposable" });
    const id = await svc.createReminder(
      userId,
      input({ spaceId: source }),
      "2026-10-07",
    );
    await spaces.deleteSpace(userId, source, "delete");
    await expect(
      svc.getReminderDetail(userId, id, "2026-10-07"),
    ).rejects.toThrow();
    expect((await spaces.getSpace(userId, spaceId)).name).toBe("Work");
  });
});
