import clsx from "clsx";
import { BellOff, ChevronRight, Repeat } from "lucide-react";
import Link from "next/link";
import { formatDisplay, formatMedium, type ISODate } from "@/lib/dates";
import { reminderTypeLabel, statusLabel, type Status } from "@/lib/domain";
import { countdown, escalationMessage, STATUS_TONE } from "@/lib/status";
import type { CategoryView, ReminderView } from "@/lib/types";
import { toneBg, toneDot, toneText } from "../ui/primitives";

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
        toneBg[tone],
        toneText[tone],
        className,
      )}
    >
      <span className={clsx("size-1.5 rounded-full", toneDot[tone])} aria-hidden />
      {statusLabel(status)}
    </span>
  );
}

export function CategoryTag({ category }: { category: CategoryView | null }) {
  if (!category) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-3">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: category.color }}
        aria-hidden
      />
      {category.name}
    </span>
  );
}

function Countdown({ r, size = "md" }: { r: ReminderView; size?: "md" | "lg" }) {
  const tone = STATUS_TONE[r.status];
  const done = r.lifecycle !== "active";
  if (done) {
    return (
      <div className="flex w-16 shrink-0 flex-col items-center justify-center text-ink-3 sm:w-20">
        <span className="text-[11px] font-medium uppercase tracking-wider">
          {formatDisplay(r.importantDate).slice(0, 6)}
        </span>
        <span className="text-[11px] tabular">{r.importantDate.slice(0, 4)}</span>
      </div>
    );
  }
  const c = countdown(r.daysRemaining);
  return (
    <div
      className={clsx(
        "flex shrink-0 flex-col items-center justify-center",
        size === "lg" ? "w-24" : "w-16 sm:w-20",
        toneText[tone],
      )}
    >
      <span
        className={clsx(
          "font-display leading-none tabular",
          c.value === "Today"
            ? "text-xl font-semibold"
            : size === "lg"
              ? "text-5xl font-medium"
              : "text-[32px] font-medium",
        )}
      >
        {c.value}
      </span>
      {c.unit && (
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] opacity-80">
          {c.unit}
        </span>
      )}
    </div>
  );
}

/** One line in a list of reminders: countdown, title, date, category. */
export function ReminderRow({ r, showStatus = true }: { r: ReminderView; showStatus?: boolean }) {
  return (
    <Link
      href={`/reminders/${r.id}`}
      className="group flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-surface-2 sm:gap-4 sm:px-3"
    >
      <Countdown r={r} />
      <div className="min-w-0 flex-1 border-l border-line pl-3 sm:pl-4">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[15px] font-semibold text-ink">{r.title}</h3>
          {r.recurrence && <Repeat className="size-3.5 shrink-0 text-ink-3" aria-label="Repeats" />}
          {r.snoozedUntil && (
            <BellOff className="size-3.5 shrink-0 text-ink-3" aria-label="Snoozed" />
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-2">
          <span className="tabular">{formatMedium(r.importantDate)}</span>
          <span className="text-ink-2"><span aria-hidden style={{color:r.space.color}}>● </span>{r.space.name}</span>
          <CategoryTag category={r.category} />
          {r.associatedWith && <span className="truncate text-ink-3">{r.associatedWith}</span>}
        </div>
        {r.lifecycle === "active" && (
          <p className={clsx("mt-0.5 text-[13px]", toneText[STATUS_TONE[r.status]])}>
            {escalationMessage(r.daysRemaining)}
          </p>
        )}
      </div>
      {showStatus && (
        <span className="hidden shrink-0 sm:block">
          <StatusPill status={r.status} />
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

export function ReminderList({
  reminders,
  showStatus,
}: {
  reminders: ReminderView[];
  showStatus?: boolean;
}) {
  return (
    <ul className="divide-y divide-line/70">
      {reminders.map((r) => (
        <li key={r.id}>
          <ReminderRow r={r} showStatus={showStatus} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The most important thing right now, presented large:
 *   ENGINEER VISA / 14 NOV 2026 / 38 DAYS LEFT / Start preparing.
 */
export function HeroReminder({ r, label }: { r: ReminderView; label: string }) {
  const tone = STATUS_TONE[r.status];
  const c = countdown(r.daysRemaining);
  return (
    <Link
      href={`/reminders/${r.id}`}
      className="group block overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-card transition-shadow hover:shadow-pop sm:p-8"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          {label}
        </span>
        <StatusPill status={r.status} />
      </div>
      <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-2">
            {r.title}
          </h3>
          <p className="font-display mt-1 text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            {formatDisplay(r.importantDate)}
          </p>
          <p className="mt-2 text-sm text-ink-2">
            {r.space.name} · {reminderTypeLabel(r.reminderType)}
            {r.associatedWith ? ` · ${r.associatedWith}` : ""}
            {r.category ? ` · ${r.category.name}` : ""}
          </p>
        </div>
        <div className={clsx("sm:text-right", toneText[tone])}>
          <p className="font-display text-6xl font-medium leading-none tabular sm:text-7xl">
            {c.value}
          </p>
          {c.unit && (
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em]">{c.unit}</p>
          )}
        </div>
      </div>
      <p className={clsx("mt-5 border-t border-line pt-4 text-[15px] font-medium", toneText[tone])}>
        {escalationMessage(r.daysRemaining)}
      </p>
    </Link>
  );
}

/**
 * Today → Preparation → Deadline. Shows how much runway is left before the
 * important date, with the first reminder marking where preparation starts.
 */
export function Timeline({
  today,
  importantDate,
  prepStart,
  status,
}: {
  today: ISODate;
  importantDate: ISODate;
  prepStart: ISODate | null;
  status: Status;
}) {
  const tone = STATUS_TONE[status];
  const toTime = (d: ISODate) => new Date(d + "T00:00:00Z").getTime();
  const overdue = today > importantDate;
  const start = Math.min(toTime(today), prepStart ? toTime(prepStart) : toTime(today));
  const end = Math.max(toTime(importantDate), toTime(today));
  const span = Math.max(end - start, 1);
  const pct = (d: ISODate) => ((toTime(d) - start) / span) * 100;
  const todayPct = pct(today);
  const prepPct = prepStart ? pct(prepStart) : null;

  return (
    <div className="pt-1">
      <div className="relative h-2 rounded-full bg-surface-3">
        {prepPct !== null && !overdue && (
          <div
            className={clsx("absolute inset-y-0 rounded-r-full opacity-35", toneDot[tone])}
            style={{ left: `${prepPct}%`, right: 0 }}
          />
        )}
        <div
          className={clsx("absolute inset-y-0 left-0 rounded-full", toneDot[tone])}
          style={{ width: `${Math.min(100, Math.max(todayPct, 1.5))}%` }}
        />
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-ink shadow"
          style={{ left: `${Math.min(100, todayPct)}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-3 grid grid-cols-3 text-[12px]">
        <div>
          <p className="font-semibold uppercase tracking-wider text-ink-3">Today</p>
          <p className="text-ink-2 tabular">{formatMedium(today)}</p>
        </div>
        <div className="text-center">
          <p className="font-semibold uppercase tracking-wider text-ink-3">Preparation</p>
          <p className="text-ink-2 tabular">{prepStart ? `from ${formatMedium(prepStart)}` : "—"}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold uppercase tracking-wider text-ink-3">
            {overdue ? "Was due" : "Deadline"}
          </p>
          <p className="text-ink-2 tabular">{formatMedium(importantDate)}</p>
        </div>
      </div>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-5 py-6 text-center text-sm text-ink-3">
      {children}
    </div>
  );
}
