"use client";
import { SpacePicker } from "../spaces/SpaceForms";

import clsx from "clsx";
import { Plus, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { addDays, diffDays, formatMedium, type ISODate } from "@/lib/dates";
import {
  looksLikeSecret,
  normalizeOffsets,
  offsetLabel,
  PRESET_OFFSETS,
  PRIORITIES,
  RECURRENCE_PRESETS,
  RECURRENCE_UNITS,
  REMINDER_TYPES,
  SECRET_WARNING,
  type Priority,
  type RecurrenceUnit,
  type ReminderType,
} from "@/lib/domain";
import type { ReminderDraft } from "@/lib/draft";
import type { CategoryView } from "@/lib/types";
import { Field, Input, Select, Textarea } from "../ui/primitives";

type Errors = Record<string, string | undefined>;

/* ------------------------------------------------------------------ */
/* Reminder timing                                                     */
/* ------------------------------------------------------------------ */

export function OffsetPicker({
  value,
  onChange,
  importantDate,
  today,
}: {
  value: number[];
  onChange: (offsets: number[]) => void;
  importantDate?: ISODate | "";
  today?: ISODate;
}) {
  const [customN, setCustomN] = useState(2);
  const [customUnit, setCustomUnit] = useState<"day" | "week" | "month">("week");
  const selected = new Set(value);
  const custom = value.filter((v) => !(PRESET_OFFSETS as readonly number[]).includes(v));

  const toggle = (o: number) => {
    const next = new Set(selected);
    if (next.has(o)) next.delete(o);
    else next.add(o);
    onChange(normalizeOffsets([...next]));
  };

  const addCustom = () => {
    const days = customN * (customUnit === "day" ? 1 : customUnit === "week" ? 7 : 30);
    if (days > 0) onChange(normalizeOffsets([...value, days]));
  };

  const past = (o: number) =>
    !!importantDate && !!today && addDays(importantDate, -o) < today;

  return (
    <div className="space-y-3">

      <div className="flex flex-wrap gap-2">
        {PRESET_OFFSETS.map((o) => {
          const on = selected.has(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              aria-pressed={on}
              className={clsx(
                "h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                on
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line bg-surface text-ink-2 hover:border-line-strong",
                on && past(o) && "opacity-50",
              )}
              title={past(o) ? "This date has already passed" : undefined}
            >
              {o === 0 ? "On the day" : o === 1 ? "1 day" : `${o} days`}
            </button>
          );
        })}
        {custom.map((o) => (
          <span
            key={o}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-accent bg-accent pl-3.5 pr-1.5 text-[13px] font-medium text-accent-ink"
          >
            {offsetLabel(o).replace(" before", "")}
            <button
              type="button"
              onClick={() => toggle(o)}
              className="rounded-full p-1 hover:bg-white/15"
              aria-label={`Remove ${offsetLabel(o)}`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <span>Custom:</span>
        <Input
          type="number"
          min={1}
          max={365}
          value={customN}
          onChange={(e) => setCustomN(Math.max(1, Number(e.target.value) || 1))}
          className="!h-9 !w-20 !px-2.5 text-[13px]"
          aria-label="Custom reminder amount"
        />
        <Select
          value={customUnit}
          onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
          className="!h-9 !w-28 text-[13px]"
          aria-label="Custom reminder unit"
        >
          <option value="day">days</option>
          <option value="week">weeks</option>
          <option value="month">months</option>
        </Select>
        <span>before</span>
        <button
          type="button"
          onClick={addCustom}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-line px-3 font-medium text-ink hover:border-line-strong"
        >
          <Plus className="size-3.5" /> Add
        </button>
      </div>
      {value.length === 0 && (
        <p className="text-[13px] text-attention">
          No advance reminders — it will still appear on your dashboard and calendar.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recurrence                                                          */
/* ------------------------------------------------------------------ */

export function RecurrencePicker({
  draft,
  set,
}: {
  draft: ReminderDraft;
  set: <K extends keyof ReminderDraft>(key: K, value: ReminderDraft[K]) => void;
}) {
  return (
    <div className="space-y-2">
      <Select
        id="recurrence"
        value={draft.recurrencePreset}
        onChange={(e) => set("recurrencePreset", e.target.value)}
      >
        {RECURRENCE_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>
      {draft.recurrencePreset === "custom" && (
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <span>Every</span>
          <Input
            type="number"
            min={1}
            max={120}
            value={draft.customInterval}
            onChange={(e) => set("customInterval", Math.max(1, Number(e.target.value) || 1))}
            className="!w-20"
            aria-label="Repeat interval"
          />
          <Select
            value={draft.customUnit}
            onChange={(e) => set("customUnit", e.target.value as RecurrenceUnit)}
            className="!w-32"
            aria-label="Repeat unit"
          >
            {RECURRENCE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}s
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Field groups                                                        */
/* ------------------------------------------------------------------ */

export function DateHint({ date, today }: { date: ISODate | ""; today: ISODate }) {
  if (!date) return null;
  const d = diffDays(today, date);
  return (
    <span className="tabular">
      {formatMedium(date)} ·{" "}
      {d === 0
        ? "today"
        : d > 0
          ? `${d} day${d === 1 ? "" : "s"} from now`
          : `${-d} day${d === -1 ? "" : "s"} ago (will show as overdue)`}
    </span>
  );
}

export function ReminderFields({
  draft,
  set,
  categories,
  today,
  errors = {},
  compact,
}: {
  draft: ReminderDraft;
  set: <K extends keyof ReminderDraft>(key: K, value: ReminderDraft[K]) => void;
  categories: CategoryView[];
  today: ISODate;
  errors?: Errors;
  compact?: boolean;
}) {
  const secretWarning =
    looksLikeSecret(draft.title) || looksLikeSecret(draft.description)
      ? SECRET_WARNING
      : undefined;
  const mentionsPassword = /\bpass(word|code)s?\b/i.test(draft.title + " " + draft.description);

  return (
    <div className="space-y-5">
      <SpacePicker value={draft.spaceId} onChange={id=>set("spaceId",id)} error={errors.spaceId}/>

      <Field label="What needs to be remembered?" htmlFor="title" error={errors.title}>
        <Input
          id="title"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. John's visa"
          maxLength={140}
          invalid={!!errors.title}
          required
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Important date"
          htmlFor="importantDate"
          error={errors.importantDate}
          hint={<DateHint date={draft.importantDate} today={today} />}
        >
          <Input
            id="importantDate"
            type="date"
            value={draft.importantDate}
            onChange={(e) => set("importantDate", e.target.value)}
            invalid={!!errors.importantDate}
            required
          />
        </Field>
        <Field label="Reminder type" htmlFor="reminderType" error={errors.reminderType}>
          <Select
            id="reminderType"
            value={draft.reminderType}
            onChange={(e) => set("reminderType", e.target.value as ReminderType)}
          >
            {REMINDER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Category" htmlFor="categoryId" error={errors.categoryId}>
          <Select
            id="categoryId"
            value={draft.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
          >
            <option value="">No category</option>
            {categories.filter(c=>c.spaceId===draft.spaceId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Who / what"
          htmlFor="associatedWith"
          optional
          error={errors.associatedWith}
          hint="The person, asset, company or item."
        >
          <Input
            id="associatedWith"
            value={draft.associatedWith}
            onChange={(e) => set("associatedWith", e.target.value)}
            placeholder="e.g. John Doe · Work Permit"
            maxLength={120}
          />
        </Field>
      </div>

      <Field label="Remind me" error={errors.offsets}>
        <OffsetPicker
          value={draft.offsets}
          onChange={(o) => set("offsets", o)}
          importantDate={draft.importantDate}
          today={today}
        />
      </Field>

      <div className={clsx("grid gap-5", !compact && "sm:grid-cols-2")}>
        <Field label="Repeats" htmlFor="recurrence" error={errors.recurrence}>
          <RecurrencePicker draft={draft} set={set} />
        </Field>
        {!compact && (
          <Field label="Priority" htmlFor="priority" hint="Higher priority escalates sooner.">
            <Select
              id="priority"
              value={draft.priority}
              onChange={(e) => set("priority", e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {!compact && (
        <Field
          label="Notes"
          htmlFor="description"
          optional
          error={errors.description ?? secretWarning}
          hint="Reference numbers, where the document is kept, who to contact…"
        >
          <Textarea
            id="description"
            rows={4}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={5000}
            invalid={!!(errors.description ?? secretWarning)}
          />
        </Field>
      )}

      {mentionsPassword && (
        <div className="flex gap-3 rounded-2xl bg-info-bg p-4 text-[13px] text-info">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            PocketMinder tracks <strong>when</strong> a password needs changing — never the password
            itself. Keep the actual password in a password manager.
          </p>
        </div>
      )}
    </div>
  );
}
