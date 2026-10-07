import { addDays, diffDays, formatMedium, relativeDays, type ISODate } from "../dates";
import {
  KEY_MILESTONE_OFFSETS,
  MINIMAL_OFFSETS,
  normalizeOffsets,
  type NotificationLevel,
  type ReminderType,
} from "../domain";
import { escalationMessage } from "../status";

/**
 * Pure notification-scheduling rules (no I/O), shared by the server and tests.
 */

export type NotificationKind = "advance" | "due" | "overdue" | "snooze";

export interface PlannedNotification {
  kind: NotificationKind;
  offsetDays: number;
  scheduledFor: ISODate;
}

/** Turn a reminder's offsets into concrete notification dates still ahead of us. */
export function planNotifications(
  importantDate: ISODate,
  offsets: number[],
  today: ISODate,
): PlannedNotification[] {
  return normalizeOffsets(offsets)
    .map((offset) => ({
      kind: (offset === 0 ? "due" : "advance") as NotificationKind,
      offsetDays: offset,
      scheduledFor: addDays(importantDate, -offset),
    }))
    .filter((n) => n.scheduledFor >= today);
}

/** Whether the user's notification level lets this notification through. */
export function allowedByLevel(
  kind: NotificationKind,
  offsetDays: number | null,
  level: NotificationLevel,
): boolean {
  if (kind === "overdue" || kind === "snooze" || kind === "due") return true;
  if (level === "all") return true;
  const allowed = level === "key" ? KEY_MILESTONE_OFFSETS : MINIMAL_OFFSETS;
  return offsetDays !== null && allowed.includes(offsetDays);
}

const TYPE_VERB: Record<ReminderType, string> = {
  expiry: "Expires",
  renewal: "Renewal due",
  deadline: "Due",
  event: "Happens",
  booking: "Book by",
  payment: "Payment due",
  appointment: "Appointment",
  follow_up: "Follow up",
  custom: "Due",
};

export function notificationText(
  r: { title: string; importantDate: ISODate; reminderType: ReminderType },
  kind: NotificationKind,
  today: ISODate,
): { title: string; body: string } {
  const days = diffDays(today, r.importantDate);
  const verb = TYPE_VERB[r.reminderType] ?? "Due";
  const when = formatMedium(r.importantDate);
  if (days < 0 || kind === "overdue") {
    return {
      title: `Overdue: ${r.title}`,
      body: `${escalationMessage(days)} It was due ${when}. Resolve or renew it once it's dealt with.`,
    };
  }
  if (kind === "snooze") {
    return {
      title: `Back on your radar: ${r.title}`,
      body: `${verb} ${relativeDays(days)} · ${when}. ${escalationMessage(days)}`,
    };
  }
  return {
    title: r.title,
    body: `${verb} ${relativeDays(days)} · ${when}. ${escalationMessage(days)}`,
  };
}

/**
 * Anti-spam: when several notifications for the same reminder are due at once
 * (e.g. the app wasn't opened for a while), only the most recent one is sent;
 * older ones are skipped.
 */
export function collapseDue<T extends { scheduledFor: ISODate }>(
  due: T[],
): { send: T | null; skip: T[] } {
  if (due.length === 0) return { send: null, skip: [] };
  const sorted = [...due].sort((a, b) => (a.scheduledFor < b.scheduledFor ? 1 : -1));
  return { send: sorted[0], skip: sorted.slice(1) };
}
