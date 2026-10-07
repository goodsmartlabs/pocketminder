/**
 * Calendar-date helpers.
 *
 * PocketMinder's important dates are calendar dates (an expiry is "14 Nov 2026",
 * not an instant in time), so they are stored and manipulated as ISO date
 * strings ("YYYY-MM-DD"). All arithmetic happens in UTC to avoid DST drift.
 * "Today" is always resolved in the user's own time zone.
 */

export type ISODate = string; // YYYY-MM-DD

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !ISO_RE.test(value)) return false;
  const d = parseISODate(value);
  return toISODate(d) === value;
}

export function parseISODate(value: ISODate): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date: Date): ISODate {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${m}-${d}`;
}

/** Build an ISO date from local calendar parts (month is 1-based). */
export function isoFromParts(year: number, month: number, day: number): ISODate {
  return toISODate(new Date(Date.UTC(year, month - 1, day)));
}

/** The current calendar date in the given IANA time zone. */
export function todayISO(timeZone = "UTC", now: Date = new Date()): ISODate {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return toISODate(now);
  }
}

/** The current hour (0-23) in the given time zone. */
export function currentHour(timeZone = "UTC", now: Date = new Date()): number {
  try {
    const h = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now);
    return Number(h) % 24;
  } catch {
    return now.getUTCHours();
  }
}

export function addDays(date: ISODate, days: number): ISODate {
  return toISODate(new Date(parseISODate(date).getTime() + days * DAY_MS));
}

/** Add calendar months, clamping to the last day of the month (Jan 31 + 1m = Feb 28/29). */
export function addMonths(date: ISODate, months: number): ISODate {
  const d = parseISODate(date);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toISODate(target);
}

export function addYears(date: ISODate, years: number): ISODate {
  return addMonths(date, years * 12);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS);
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function startOfMonth(date: ISODate): ISODate {
  return date.slice(0, 8) + "01";
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayMondayFirst(date: ISODate): number {
  return (parseISODate(date).getUTCDay() + 6) % 7;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "14 November 2026" */
export function formatLong(date: ISODate): string {
  const d = parseISODate(date);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "14 Nov 2026" */
export function formatMedium(date: ISODate): string {
  const d = parseISODate(date);
  return `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "14 NOV 2026" */
export function formatDisplay(date: ISODate): string {
  const d = parseISODate(date);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${SHORT_MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCFullYear()}`;
}

/** "Sat, 14 Nov" */
export function formatShort(date: ISODate): string {
  const d = parseISODate(date);
  return `${WEEKDAYS[d.getUTCDay()].slice(0, 3)}, ${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}`;
}

export function formatWeekday(date: ISODate): string {
  return WEEKDAYS[parseISODate(date).getUTCDay()];
}

export function formatMonthYear(date: ISODate): string {
  const d = parseISODate(date);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "in 3 days", "tomorrow", "today", "yesterday", "5 days ago" */
export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/** Format a timestamp (ms or ISO string) for activity logs, in the user's zone. */
export function formatTimestamp(value: number | string | Date, timeZone = "UTC"): string {
  const d = value instanceof Date ? value : new Date(value);
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}
