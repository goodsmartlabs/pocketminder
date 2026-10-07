"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  addMonths,
  daysInMonth,
  formatLong,
  formatMonthYear,
  formatWeekday,
  isoFromParts,
  weekdayMondayFirst,
  type ISODate,
} from "@/lib/dates";
import { STATUS_TONE } from "@/lib/status";
import type { CategoryView, ReminderView } from "@/lib/types";
import { EmptyNote, ReminderList } from "../reminders/display";
import { useQuickCapture } from "../shell/QuickCapture";
import { Button, toneDot } from "../ui/primitives";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({
  reminders,
  categories,
  today,
}: {
  reminders: ReminderView[];
  categories: CategoryView[];
  today: ISODate;
}) {
  const { open } = useQuickCapture();
  const [month, setMonth] = useState<ISODate>(today.slice(0, 8) + "01");
  const [selected, setSelected] = useState<ISODate>(today);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => reminders.filter((r) => !hidden.has(r.category?.id ?? "none")),
    [reminders, hidden],
  );

  const byDate = useMemo(() => {
    const map = new Map<ISODate, ReminderView[]>();
    for (const r of visible) {
      const list = map.get(r.importantDate) ?? [];
      list.push(r);
      map.set(r.importantDate, list);
    }
    return map;
  }, [visible]);

  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const lead = weekdayMondayFirst(month);
  const total = daysInMonth(year, m);
  const cells: (ISODate | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => isoFromParts(year, m, i + 1)),
  ];
  while (cells.length % 7) cells.push(null);

  const selectedItems = byDate.get(selected) ?? [];
  const upcoming = visible
    .filter((r) => r.lifecycle === "active" && r.importantDate >= today)
    .sort((a, b) => a.importantDate.localeCompare(b.importantDate))
    .slice(0, 8);
  const monthCount = visible.filter((r) => r.importantDate.startsWith(month.slice(0, 7))).length;

  const toggleCategory = (id: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const usedCategories = categories.filter((c) => reminders.some((r) => r.category?.id === c.id));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-medium text-ink">{formatMonthYear(month)}</h2>
            <p className="text-[13px] text-ink-3">
              {monthCount} important date{monthCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setMonth(today.slice(0, 8) + "01");
                setSelected(today);
              }}
            >
              Today
            </Button>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              className="inline-flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              className="inline-flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
              aria-label="Next month"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        {usedCategories.length > 0 && (
          <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {usedCategories.map((c) => {
              const on = !hidden.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  aria-pressed={on}
                  className={clsx(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-opacity",
                    on ? "border-line bg-surface text-ink" : "border-dashed border-line text-ink-3 opacity-60",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2/50">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-3"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7" role="grid">
            {cells.map((date, i) => {
              if (!date)
                return <div key={`e${i}`} className="min-h-14 border-b border-r border-line/60 bg-surface-2/30 sm:min-h-24" />;
              const items = byDate.get(date) ?? [];
              const isToday = date === today;
              const isSelected = date === selected;
              const day = Number(date.slice(8));
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  onClick={() => setSelected(date)}
                  aria-label={`${formatLong(date)}${items.length ? `, ${items.length} reminder${items.length === 1 ? "" : "s"}` : ""}`}
                  aria-selected={isSelected}
                  className={clsx(
                    "relative flex min-h-14 flex-col items-center gap-1 border-b border-r border-line/60 p-1.5 text-left transition-colors sm:min-h-24 sm:items-stretch sm:p-2",
                    (i + 1) % 7 === 0 && "border-r-0",
                    isSelected ? "bg-accent-soft" : "hover:bg-surface-2",
                  )}
                >
                  <span
                    className={clsx(
                      "inline-flex size-7 items-center justify-center rounded-full text-[13px] tabular",
                      isToday ? "bg-accent font-semibold text-accent-ink" : "text-ink-2",
                      date < today && !isToday && "text-ink-3",
                    )}
                  >
                    {day}
                  </span>
                  {items.length > 0 && (
                    <>
                      <span className="flex gap-0.5 sm:hidden">
                        {items.slice(0, 3).map((r) => (
                          <span
                            key={r.id}
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: r.category?.color ?? "var(--ink-3)" }}
                          />
                        ))}
                      </span>
                      <span className="hidden w-full flex-col gap-0.5 sm:flex">
                        {items.slice(0, 2).map((r) => (
                          <span
                            key={r.id}
                            className={clsx(
                              "flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                              r.lifecycle === "active" ? "text-ink" : "text-ink-3 line-through",
                            )}
                            style={{
                              backgroundColor: `color-mix(in srgb, ${r.category?.color ?? "#888"} 14%, transparent)`,
                            }}
                          >
                            <span
                              className={clsx("size-1.5 shrink-0 rounded-full", toneDot[STATUS_TONE[r.status]])}
                            />
                            <span className="truncate">{r.title}</span>
                          </span>
                        ))}
                        {items.length > 2 && (
                          <span className="px-1.5 text-[11px] text-ink-3">+{items.length - 2} more</span>
                        )}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="space-y-6">
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[15px] font-semibold text-ink">
              {selected === today ? "Today" : formatWeekday(selected)}
              <span className="ml-2 font-normal text-ink-3">{formatLong(selected)}</span>
            </h3>
          </div>
          {selectedItems.length ? (
            <div className="rounded-2xl border border-line bg-surface p-1 shadow-card">
              <ReminderList reminders={selectedItems} showStatus={false} />
            </div>
          ) : (
            <EmptyNote>
              Nothing on this date.{" "}
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => open(` on ${formatLong(selected)}`)}
              >
                Add something
              </button>
            </EmptyNote>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            Upcoming dates
          </h3>
          {upcoming.length ? (
            <div className="rounded-2xl border border-line bg-surface p-1 shadow-card">
              <ReminderList reminders={upcoming} showStatus={false} />
            </div>
          ) : (
            <EmptyNote>No upcoming dates.</EmptyNote>
          )}
        </section>
      </aside>
    </div>
  );
}
