import { Suspense } from "react";
import { EmptyNote, ReminderList } from "@/components/reminders/display";
import { RegisterControls } from "@/components/reminders/RegisterControls";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { applyRegister, parseRegisterQuery } from "@/lib/register";
import { listCategories, listReminders } from "@/server/reminders";

export const metadata = { title: "Archive" };

const ARCHIVE_VIEWS = [
  { value: "archived", label: "Archived" },
  { value: "resolved", label: "Resolved" },
  { value: "renewed", label: "Renewed" },
] as const;

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const today = todayISO(user.timezone);
  const raw = await searchParams;
  const parsed = parseRegisterQuery(raw);
  const view = ARCHIVE_VIEWS.some((v) => v.value === parsed.view) ? parsed.view : "archived";
  const query = { ...parsed, view, sort: raw.sort ? parsed.sort : ("furthest" as const) };
  const all = listReminders(user.id, today, { lifecycles: ["archived", "resolved", "renewed"] });
  const results = applyRegister(all, query);
  const counts: Record<string, number> = {};
  for (const v of ARCHIVE_VIEWS) {
    counts[v.value] = all.filter((r) => r.lifecycle === v.value).length;
  }
  const people = Array.from(
    new Set(all.map((r) => r.associatedWith).filter((x): x is string => !!x)),
  ).sort();

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Archive"
        subtitle="Past periods, resolved dates and anything you've put away. Nothing is lost."
      />
      <Suspense>
        <RegisterControls
          query={query}
          categories={listCategories(user.id)}
          people={people}
          counts={counts}
          views={ARCHIVE_VIEWS}
        />
      </Suspense>
      <div className="mt-6">
        {results.length === 0 ? (
          <EmptyNote>
            {view === "archived"
              ? "Nothing archived. Archive a reminder to tuck it away without deleting it."
              : view === "renewed"
                ? "No renewed periods yet. When you renew something, its previous period lands here."
                : "Nothing resolved yet."}
          </EmptyNote>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-1 shadow-card sm:p-2">
            <ReminderList reminders={results} />
          </div>
        )}
      </div>
    </div>
  );
}
