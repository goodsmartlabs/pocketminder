import { formatLong, formatMedium, MONTHS, parseISODate } from "./dates";
import { reminderTypeLabel, statusLabel } from "./domain";
import type { ReminderView } from "./types";

/** Text a reminder can be found by: title, notes, person/item, category, type, status and date. */
function haystack(r: ReminderView): string {
  const d = parseISODate(r.importantDate);
  return [
    r.title,
    r.description ?? "",
    r.associatedWith ?? "",
    r.category?.name ?? "",
    reminderTypeLabel(r.reminderType),
    statusLabel(r.status),
    MONTHS[d.getUTCMonth()],
    String(d.getUTCFullYear()),
    formatLong(r.importantDate),
    formatMedium(r.importantDate),
    r.importantDate,
  ]
    .join(" \u0000 ")
    .toLowerCase();
}

/** Every word of the query must appear somewhere ("john visa", "insurance december"). */
export function matchesText(r: ReminderView, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = haystack(r);
  return terms.every((t) => hay.includes(t));
}
