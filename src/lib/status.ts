import { diffDays, type ISODate } from "./dates";
import type { Lifecycle, Priority, Status } from "./domain";

/**
 * Automatic urgency.
 *
 * An active reminder's status is derived from how close its important date is,
 * so it changes by itself every day. Higher-priority reminders escalate sooner.
 */

interface Thresholds {
  urgent: number;
  attention: number;
  upcoming: number;
}

const THRESHOLDS: Record<Priority, Thresholds> = {
  low: { urgent: 3, attention: 14, upcoming: 60 },
  normal: { urgent: 7, attention: 30, upcoming: 90 },
  high: { urgent: 14, attention: 45, upcoming: 120 },
  critical: { urgent: 14, attention: 60, upcoming: 180 },
};

export interface StatusInput {
  lifecycle: Lifecycle;
  importantDate: ISODate;
  priority: Priority;
}

export function computeStatus(r: StatusInput, today: ISODate): Status {
  if (r.lifecycle !== "active") return r.lifecycle;
  const days = diffDays(today, r.importantDate);
  const t = THRESHOLDS[r.priority] ?? THRESHOLDS.normal;
  if (days < 0) return "overdue";
  if (days === 0) return "due_today";
  if (days <= t.urgent) return "urgent";
  if (days <= t.attention) return "needs_attention";
  if (days <= t.upcoming) return "upcoming";
  return "safe";
}

/** Short human guidance that escalates as the date approaches. */
export function escalationMessage(days: number, lifecycle: Lifecycle = "active"): string {
  if (lifecycle === "resolved") return "Resolved. Nothing more to do.";
  if (lifecycle === "renewed") return "Renewed. The next cycle is being tracked.";
  if (lifecycle === "archived") return "Archived.";
  if (days < 0) return days === -1 ? "Overdue since yesterday." : `Overdue by ${-days} days.`;
  if (days === 0) return "Due today.";
  if (days === 1) return "Due tomorrow.";
  if (days <= 7) return "Due next week.";
  if (days <= 14) return "Getting close.";
  if (days <= 30) return "Action needed.";
  if (days <= 60) return "Start preparing.";
  if (days <= 90) return "Coming up.";
  return "Safely ahead. Nothing to do yet.";
}

/** Ordering for "sort by urgency": most pressing first. */
export const URGENCY_RANK: Record<Status, number> = {
  overdue: 0,
  due_today: 1,
  urgent: 2,
  needs_attention: 3,
  upcoming: 4,
  safe: 5,
  renewed: 6,
  resolved: 7,
  archived: 8,
};

export type Tone = "calm" | "info" | "attention" | "urgent" | "critical" | "done" | "muted";

export const STATUS_TONE: Record<Status, Tone> = {
  safe: "calm",
  upcoming: "info",
  needs_attention: "attention",
  urgent: "urgent",
  due_today: "critical",
  overdue: "critical",
  renewed: "done",
  resolved: "done",
  archived: "muted",
};

/** Countdown text for big displays: { value: "38", unit: "days left" } */
export function countdown(days: number): { value: string; unit: string } {
  if (days === 0) return { value: "Today", unit: "" };
  if (days === 1) return { value: "1", unit: "day left" };
  if (days > 0) return { value: String(days), unit: "days left" };
  if (days === -1) return { value: "1", unit: "day overdue" };
  return { value: String(-days), unit: "days overdue" };
}
