/**
 * Shared domain vocabulary for PocketMinder. Safe to import from both server
 * and client code.
 */

export const DEFAULT_CATEGORIES = [
  { slug: "documents", name: "Documents", color: "#5b7fa6", icon: "file-badge" },
  { slug: "agreements", name: "Agreements", color: "#7a6aa8", icon: "file-signature" },
  { slug: "people", name: "People", color: "#c07a8f", icon: "users" },
  { slug: "travel", name: "Travel", color: "#3f8f8a", icon: "plane" },
  { slug: "work", name: "Work", color: "#6d7a8c", icon: "briefcase" },
  { slug: "payments", name: "Payments", color: "#b0894a", icon: "wallet" },
  { slug: "personal", name: "Personal", color: "#6f9a5e", icon: "heart" },
  { slug: "recurring", name: "Recurring", color: "#8a7f72", icon: "repeat" },
  { slug: "custom", name: "Custom", color: "#7d8590", icon: "tag" },
] as const;

export type DefaultCategorySlug = (typeof DEFAULT_CATEGORIES)[number]["slug"];

export const CATEGORY_COLORS = [
  "#5b7fa6",
  "#7a6aa8",
  "#c07a8f",
  "#3f8f8a",
  "#6d7a8c",
  "#b0894a",
  "#6f9a5e",
  "#8a7f72",
  "#a8675a",
  "#4f8fb8",
];

export const REMINDER_TYPES = [
  { value: "expiry", label: "Expiry" },
  { value: "renewal", label: "Renewal" },
  { value: "deadline", label: "Deadline" },
  { value: "event", label: "Event" },
  { value: "booking", label: "Booking" },
  { value: "payment", label: "Payment" },
  { value: "appointment", label: "Appointment" },
  { value: "follow_up", label: "Follow-up" },
  { value: "custom", label: "Custom" },
] as const;

export type ReminderType = (typeof REMINDER_TYPES)[number]["value"];
export const REMINDER_TYPE_VALUES = REMINDER_TYPES.map((t) => t.value) as [
  ReminderType,
  ...ReminderType[],
];

export function reminderTypeLabel(type: string): string {
  return REMINDER_TYPES.find((t) => t.value === type)?.label ?? "Custom";
}

/** Types where the date is something that lapses and gets renewed. */
export const RENEWABLE_TYPES: ReminderType[] = ["expiry", "renewal"];

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export type Priority = (typeof PRIORITIES)[number]["value"];
export const PRIORITY_VALUES = PRIORITIES.map((p) => p.value) as [Priority, ...Priority[]];

/* ------------------------------------------------------------------ */
/* Reminder timing (advance notifications)                             */
/* ------------------------------------------------------------------ */

export const PRESET_OFFSETS = [90, 60, 30, 14, 7, 3, 1, 0] as const;

export const DEFAULT_OFFSETS_BY_TYPE: Record<ReminderType, number[]> = {
  expiry: [90, 60, 30, 14, 7, 1, 0],
  renewal: [90, 60, 30, 14, 7, 1, 0],
  deadline: [30, 14, 7, 3, 1, 0],
  booking: [30, 14, 7, 3, 1, 0],
  payment: [14, 7, 3, 1, 0],
  appointment: [7, 1, 0],
  event: [14, 7, 1, 0],
  follow_up: [7, 1, 0],
  custom: [30, 7, 1, 0],
};

export const MAX_OFFSET_DAYS = 3650;

export function normalizeOffsets(offsets: number[]): number[] {
  return Array.from(
    new Set(
      offsets
        .map((o) => Math.round(o))
        .filter((o) => Number.isFinite(o) && o >= 0 && o <= MAX_OFFSET_DAYS),
    ),
  ).sort((a, b) => b - a);
}

export function offsetLabel(days: number): string {
  if (days === 0) return "On the day";
  if (days === 1) return "1 day before";
  if (days % 365 === 0) return days === 365 ? "1 year before" : `${days / 365} years before`;
  if (days % 7 === 0 && days <= 56 && days !== 14 && days !== 7)
    return `${days / 7} weeks before`;
  if (days === 7) return "1 week before";
  return `${days} days before`;
}

/** "60 days, 30 days, 1 week and 1 day before, and on the day" */
export function offsetsSummary(offsets: number[]): string {
  const sorted = normalizeOffsets(offsets);
  if (sorted.length === 0) return "No advance reminders";
  const before = sorted.filter((o) => o > 0).map((o) => offsetLabel(o).replace(" before", ""));
  const onDay = sorted.includes(0);
  const parts: string[] = [];
  if (before.length) {
    const list =
      before.length === 1 ? before[0] : `${before.slice(0, -1).join(", ")} and ${before.at(-1)}`;
    parts.push(`${list} before`);
  }
  if (onDay) parts.push(before.length ? "and on the day" : "On the day");
  return parts.join(", ");
}

/* ------------------------------------------------------------------ */
/* Recurrence                                                          */
/* ------------------------------------------------------------------ */

export const RECURRENCE_UNITS = ["day", "week", "month", "year"] as const;
export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number];

export interface Recurrence {
  unit: RecurrenceUnit;
  interval: number;
}

export const RECURRENCE_PRESETS: { value: string; label: string; recurrence: Recurrence | null }[] =
  [
    { value: "none", label: "Does not repeat", recurrence: null },
    { value: "weekly", label: "Weekly", recurrence: { unit: "week", interval: 1 } },
    { value: "monthly", label: "Monthly", recurrence: { unit: "month", interval: 1 } },
    { value: "quarterly", label: "Every 3 months", recurrence: { unit: "month", interval: 3 } },
    { value: "semiannual", label: "Every 6 months", recurrence: { unit: "month", interval: 6 } },
    { value: "annually", label: "Annually", recurrence: { unit: "year", interval: 1 } },
    { value: "custom", label: "Custom interval", recurrence: null },
  ];

export function recurrencePresetFor(rec: Recurrence | null): string {
  if (!rec) return "none";
  const match = RECURRENCE_PRESETS.find(
    (p) => p.recurrence && p.recurrence.unit === rec.unit && p.recurrence.interval === rec.interval,
  );
  return match?.value ?? "custom";
}

export function recurrenceLabel(rec: Recurrence | null): string {
  if (!rec) return "Does not repeat";
  const preset = RECURRENCE_PRESETS.find(
    (p) => p.recurrence && p.recurrence.unit === rec.unit && p.recurrence.interval === rec.interval,
  );
  if (preset) return preset.label;
  return `Every ${rec.interval} ${rec.unit}${rec.interval === 1 ? "" : "s"}`;
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

/** Lifecycle state stored on the reminder row. */
export const LIFECYCLES = ["active", "resolved", "renewed", "archived"] as const;
export type Lifecycle = (typeof LIFECYCLES)[number];

/** User-facing status: lifecycle + automatic urgency for active reminders. */
export const STATUSES = [
  { value: "safe", label: "Safe" },
  { value: "upcoming", label: "Upcoming" },
  { value: "needs_attention", label: "Needs Attention" },
  { value: "urgent", label: "Urgent" },
  { value: "due_today", label: "Due Today" },
  { value: "overdue", label: "Overdue" },
  { value: "renewed", label: "Renewed" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
] as const;

export type Status = (typeof STATUSES)[number]["value"];

export function statusLabel(status: Status): string {
  return STATUSES.find((s) => s.value === status)?.label ?? status;
}

/* ------------------------------------------------------------------ */
/* Notification preferences                                            */
/* ------------------------------------------------------------------ */

export const NOTIFICATION_LEVELS = [
  {
    value: "all",
    label: "Every scheduled reminder",
    description: "Notify me at every advance reminder I've set.",
  },
  {
    value: "key",
    label: "Key milestones only",
    description: "Only 30 days, 7 days, 1 day before and on the day.",
  },
  {
    value: "minimal",
    label: "Final week only",
    description: "Only 7 days before and on the day. Overdue items still surface.",
  },
] as const;

export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number]["value"];

export const KEY_MILESTONE_OFFSETS = [30, 7, 1, 0];
export const MINIMAL_OFFSETS = [7, 0];

/** How often an unresolved overdue reminder re-surfaces as a notification. */
export const OVERDUE_RENOTIFY_DAYS = 7;

/* ------------------------------------------------------------------ */
/* Safety: PocketMinder tracks *when* to change a password, never the  */
/* password itself.                                                    */
/* ------------------------------------------------------------------ */

const SECRET_PATTERNS = [
  /\b(password|passwd|passcode|pwd|pin|passphrase|secret|api[\s_-]?key|token)\b\s*[:=]\s*\S+/i,
  /\b(pw|pass)\s*[:=]\s*\S+/i,
];

export function looksLikeSecret(text: string | null | undefined): boolean {
  if (!text) return false;
  return SECRET_PATTERNS.some((re) => re.test(text));
}

export const SECRET_WARNING =
  "PocketMinder tracks when a password needs changing, never the password itself. Please remove it.";
