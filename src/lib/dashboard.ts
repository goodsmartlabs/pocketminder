import type { ReminderView } from "./types";

/**
 * Splits active reminders into the four questions PocketMinder answers:
 * Overdue, Today, Coming up, Later.
 */
export const COMING_UP_DAYS = 90;

export interface Dashboard {
  overdue: ReminderView[];
  today: ReminderView[];
  comingUp: ReminderView[];
  later: ReminderView[];
  next: ReminderView | null;
  counts: { needsAttention: number; next7: number; next30: number; overdue: number };
}

/** Reminders whose date is today, or that hit one of their reminder milestones today. */
export function isForToday(r: ReminderView): boolean {
  if (r.lifecycle !== "active") return false;
  if (r.daysRemaining === 0) return true;
  return r.daysRemaining > 0 && !r.snoozedUntil && r.offsets.includes(r.daysRemaining);
}

export function buildDashboard(reminders: ReminderView[]): Dashboard {
  const active = reminders
    .filter((r) => r.lifecycle === "active")
    .sort((a, b) => a.daysRemaining - b.daysRemaining || a.title.localeCompare(b.title));

  const overdue = active.filter((r) => r.daysRemaining < 0);
  const today = active.filter(isForToday);
  const comingUp = active.filter((r) => r.daysRemaining > 0 && r.daysRemaining <= COMING_UP_DAYS);
  const later = active.filter((r) => r.daysRemaining > COMING_UP_DAYS);

  return {
    overdue,
    today,
    comingUp,
    later,
    next: active.find((r) => r.daysRemaining >= 0) ?? null,
    counts: {
      needsAttention: active.filter((r) =>
        ["needs_attention", "urgent", "due_today"].includes(r.status),
      ).length,
      next7: active.filter((r) => r.daysRemaining >= 0 && r.daysRemaining <= 7).length,
      next30: active.filter((r) => r.daysRemaining >= 0 && r.daysRemaining <= 30).length,
      overdue: overdue.length,
    },
  };
}

export function greeting(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
