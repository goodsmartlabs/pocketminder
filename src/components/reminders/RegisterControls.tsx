"use client";

import clsx from "clsx";
import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { REMINDER_TYPES, STATUSES } from "@/lib/domain";
import { REGISTER_VIEWS, SORTS, type RegisterQuery } from "@/lib/register";
import type { CategoryView } from "@/lib/types";
import { Select, Spinner } from "../ui/primitives";

export function RegisterControls({
  query,
  categories,
  people,
  counts,
  views = REGISTER_VIEWS,
}: {
  query: RegisterQuery;
  categories: CategoryView[];
  people: string[];
  counts: Record<string, number>;
  views?: readonly { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(query.q);
  const activeFilters = [query.category, query.type, query.who, query.status].filter(Boolean).length;
  const [showFilters, setShowFilters] = useState(activeFilters > 0);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced search-as-you-type.
  useEffect(() => {
    if (q === query.q) return;
    const t = setTimeout(() => update({ q }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const viewHref = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v === "all") next.delete("view");
    else next.set("view", v);
    return `${pathname}?${next.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {views.map((v) => {
          const active = query.view === v.value;
          return (
            <Link
              key={v.value}
              href={viewHref(v.value)}
              scroll={false}
              replace
              className={clsx(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-ink text-bg"
                  : "border border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              {v.label}
              {counts[v.value] !== undefined && (
                <span className={clsx("tabular", active ? "opacity-70" : "text-ink-3")}>
                  {counts[v.value]}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reminders"
            aria-label="Search reminders"
            className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-[14px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
          />
        </div>
        <Select
          value={query.sort}
          onChange={(e) => update({ sort: e.target.value === "closest" ? "" : e.target.value })}
          className="!h-10 !w-auto !rounded-full text-[14px]"
          aria-label="Sort by"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          aria-expanded={showFilters}
          className={clsx(
            "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors",
            showFilters || activeFilters
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-surface text-ink-2 hover:border-line-strong",
          )}
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {activeFilters > 0 && <span className="tabular">· {activeFilters}</span>}
        </button>
        {pending && <Spinner className="size-4 text-ink-3" />}
      </div>

      {showFilters && (
        <div className="animate-fade-up grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-4">
          <Select
            value={query.category}
            onChange={(e) => update({ category: e.target.value })}
            aria-label="Category"
            className="!h-10 text-[14px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={query.type}
            onChange={(e) => update({ type: e.target.value })}
            aria-label="Reminder type"
            className="!h-10 text-[14px]"
          >
            <option value="">All types</option>
            {REMINDER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select
            value={query.who}
            onChange={(e) => update({ who: e.target.value })}
            aria-label="Person or item"
            className="!h-10 text-[14px]"
          >
            <option value="">Anyone / anything</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Select
            value={query.status}
            onChange={(e) => update({ status: e.target.value })}
            aria-label="Status"
            className="!h-10 text-[14px]"
          >
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={() => update({ category: "", type: "", who: "", status: "" })}
              className="inline-flex items-center gap-1 justify-self-start text-[13px] font-medium text-ink-3 hover:text-ink sm:col-span-4"
            >
              <X className="size-3.5" /> Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
