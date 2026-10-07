import type { ISODate } from "./dates";
import {
  DEFAULT_OFFSETS_BY_TYPE,
  RECURRENCE_PRESETS,
  recurrencePresetFor,
  type Priority,
  type Recurrence,
  type RecurrenceUnit,
  type ReminderType,
} from "./domain";
import type { ParsedReminder } from "./parser";
import type { CategoryView, ReminderView } from "./types";

/** Editable form state shared by quick capture, the manual form and edit. */
export interface ReminderDraft {
  title: string;
  importantDate: ISODate | "";
  categoryId: string;
  reminderType: ReminderType;
  associatedWith: string;
  description: string;
  priority: Priority;
  offsets: number[];
  recurrencePreset: string;
  customInterval: number;
  customUnit: RecurrenceUnit;
}

export function emptyDraft(categories: CategoryView[], defaultOffsets?: number[]): ReminderDraft {
  return {
    title: "",
    importantDate: "",
    categoryId: categories.find((c) => c.slug === "personal")?.id ?? categories[0]?.id ?? "",
    reminderType: "expiry",
    associatedWith: "",
    description: "",
    priority: "normal",
    offsets: defaultOffsets ?? DEFAULT_OFFSETS_BY_TYPE.expiry,
    recurrencePreset: "none",
    customInterval: 2,
    customUnit: "year",
  };
}

export function draftFromParsed(p: ParsedReminder, categories: CategoryView[]): ReminderDraft {
  const preset = recurrencePresetFor(p.recurrence);
  return {
    title: p.title,
    importantDate: p.date ?? "",
    categoryId:
      categories.find((c) => c.slug === p.categorySlug)?.id ??
      categories.find((c) => c.slug === "personal")?.id ??
      "",
    reminderType: p.type,
    associatedWith: p.associatedWith ?? "",
    description: "",
    priority: p.priority,
    offsets: p.offsets,
    recurrencePreset: preset,
    customInterval: p.recurrence?.interval ?? 2,
    customUnit: p.recurrence?.unit ?? "year",
  };
}

export function draftFromReminder(r: ReminderView): ReminderDraft {
  return {
    title: r.title,
    importantDate: r.importantDate,
    categoryId: r.category?.id ?? "",
    reminderType: r.reminderType,
    associatedWith: r.associatedWith ?? "",
    description: r.description ?? "",
    priority: r.priority,
    offsets: r.offsets,
    recurrencePreset: recurrencePresetFor(r.recurrence),
    customInterval: r.recurrence?.interval ?? 2,
    customUnit: r.recurrence?.unit ?? "year",
  };
}

export function draftRecurrence(d: ReminderDraft): Recurrence | null {
  if (d.recurrencePreset === "custom") {
    return { unit: d.customUnit, interval: Math.max(1, Math.round(d.customInterval || 1)) };
  }
  return RECURRENCE_PRESETS.find((p) => p.value === d.recurrencePreset)?.recurrence ?? null;
}

/** Shape sent to the create/update server actions (validated there). */
export function draftToInput(d: ReminderDraft) {
  return {
    title: d.title,
    importantDate: d.importantDate,
    categoryId: d.categoryId || null,
    reminderType: d.reminderType,
    associatedWith: d.associatedWith || null,
    description: d.description || null,
    priority: d.priority,
    offsets: d.offsets,
    recurrence: draftRecurrence(d),
  };
}

/**
 * Apply a field change. Switching the reminder type also switches the
 * reminder timing to that type's defaults, unless the user customised it.
 */
export function applyDraftChange<K extends keyof ReminderDraft>(
  d: ReminderDraft,
  key: K,
  value: ReminderDraft[K],
): ReminderDraft {
  const next = { ...d, [key]: value };
  if (key === "reminderType") {
    const prevDefaults = DEFAULT_OFFSETS_BY_TYPE[d.reminderType];
    const untouched =
      prevDefaults.length === d.offsets.length && prevDefaults.every((o, i) => o === d.offsets[i]);
    if (untouched) next.offsets = DEFAULT_OFFSETS_BY_TYPE[value as ReminderType];
  }
  return next;
}
