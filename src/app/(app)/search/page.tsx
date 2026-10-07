import { Suspense } from "react";
import { EmptyNote, ReminderList } from "@/components/reminders/display";
import { SearchBox } from "@/components/shell/Navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { searchReminders } from "@/server/reminders";

export const metadata = { title: "Search" };

const SUGGESTIONS = ["visa", "passport", "insurance", "renewal", "September"];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const q = ((await searchParams).q ?? "").slice(0, 200);
  const results = q ? searchReminders(user.id, q, todayISO(user.timezone)) : [];

  return (
    <div className="animate-fade-up">
      <PageHeader title="Search" subtitle="Find any date by name, person, item, category or month." />
      <Suspense>
        <SearchBox className="lg:hidden" autoFocus={!q} />
      </Suspense>
      <div className="mt-6">
        {!q ? (
          <div>
            <p className="mb-3 text-[13px] text-ink-3">Try</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <a
                  key={s}
                  href={`/search?q=${encodeURIComponent(s)}`}
                  className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] text-ink-2 hover:border-line-strong hover:text-ink"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <EmptyNote>Nothing matches “{q}”.</EmptyNote>
        ) : (
          <>
            <p className="mb-3 text-[13px] text-ink-3">
              {results.length} result{results.length === 1 ? "" : "s"} for “{q}”
            </p>
            <div className="rounded-2xl border border-line bg-surface p-1 shadow-card sm:p-2">
              <ReminderList reminders={results} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
