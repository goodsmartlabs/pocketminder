import { describe, expect, it } from "vitest";
import { addMonths, diffDays } from "@/lib/dates";
import { looksLikeSecret, offsetsSummary } from "@/lib/domain";
import {
  allowedByLevel,
  collapseDue,
  planNotifications,
} from "@/lib/notifications/schedule";
import { computeStatus, escalationMessage } from "@/lib/status";

describe("dates", () => {
  it("clamps month arithmetic to the end of month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
    expect(diffDays("2026-10-07", "2026-11-14")).toBe(38);
  });
});

describe("status", () => {
  const s = (date: string, priority: "normal" | "high" = "normal") =>
    computeStatus({ lifecycle: "active", importantDate: date, priority }, "2026-10-07");
  it("escalates with proximity", () => {
    expect(s("2027-06-01")).toBe("safe");
    expect(s("2026-12-01")).toBe("upcoming");
    expect(s("2026-10-30")).toBe("needs_attention");
    expect(s("2026-10-12")).toBe("urgent");
    expect(s("2026-10-07")).toBe("due_today");
    expect(s("2026-10-01")).toBe("overdue");
  });
  it("escalates high priority sooner", () => {
    expect(s("2026-10-19")).toBe("needs_attention");
    expect(s("2026-10-19", "high")).toBe("urgent");
  });
  it("keeps lifecycle states", () => {
    expect(
      computeStatus({ lifecycle: "renewed", importantDate: "2026-01-01", priority: "normal" }, "2026-10-07"),
    ).toBe("renewed");
  });
  it("uses the escalation language", () => {
    expect(escalationMessage(60)).toBe("Start preparing.");
    expect(escalationMessage(30)).toBe("Action needed.");
    expect(escalationMessage(14)).toBe("Getting close.");
    expect(escalationMessage(7)).toBe("Due next week.");
    expect(escalationMessage(1)).toBe("Due tomorrow.");
    expect(escalationMessage(0)).toBe("Due today.");
  });
});

describe("notification scheduling", () => {
  it("plans only future notifications", () => {
    const plan = planNotifications("2026-10-20", [30, 7, 1, 0], "2026-10-07");
    expect(plan.map((p) => p.scheduledFor)).toEqual(["2026-10-13", "2026-10-19", "2026-10-20"]);
    expect(plan.at(-1)?.kind).toBe("due");
  });
  it("collapses a backlog to the latest one", () => {
    const { send, skip } = collapseDue([
      { scheduledFor: "2026-09-01" },
      { scheduledFor: "2026-10-01" },
      { scheduledFor: "2026-09-15" },
    ]);
    expect(send?.scheduledFor).toBe("2026-10-01");
    expect(skip).toHaveLength(2);
  });
  it("filters by notification level", () => {
    expect(allowedByLevel("advance", 60, "key")).toBe(false);
    expect(allowedByLevel("advance", 30, "key")).toBe(true);
    expect(allowedByLevel("advance", 30, "minimal")).toBe(false);
    expect(allowedByLevel("overdue", null, "minimal")).toBe(true);
  });
  it("summarises timing", () => {
    expect(offsetsSummary([60, 30, 1, 0])).toBe("60 days, 30 days and 1 day before, and on the day");
  });
});

describe("password safety", () => {
  it("flags secrets but not password-change reminders", () => {
    expect(looksLikeSecret("password: hunter2")).toBe(true);
    expect(looksLikeSecret("Change company email password on October 1")).toBe(false);
  });
});
