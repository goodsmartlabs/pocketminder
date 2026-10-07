import { Plus } from "lucide-react";
import { Suspense } from "react";
import { EmptyNote, ReminderList } from "@/components/reminders/display";
import { RegisterControls } from "@/components/reminders/RegisterControls";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import {
  applyRegister,
  HIDDEN_VIEWS,
  parseRegisterQuery,
  REGISTER_VIEWS,
} from "@/lib/register";
import { listCategories, listReminders } from "@/server/reminders";

export const metadata = { title: "Reminders" };

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const today = todayISO(user.timezone);
  const params = await searchParams;
  const space = typeof params.space === "string" ? params.space : undefined;
  const query = parseRegisterQuery(params);
  const all = listReminders(user.id, today, {spaceId:space});
  const categories = listCategories(user.id,space);
  const results = applyRegister(all, query);

  const counts: Record<string, number> = {};
  for (const v of REGISTER_VIEWS) {
    counts[v.value] = applyRegister(all, { ...query, view: v.value, q: "" , category: "", type: "", who: "", status: "" }).length;
  }
  const people = Array.from(
    new Set(all.map((r) => r.associatedWith).filter((x): x is string => !!x)),
  ).sort((a, b) => a.localeCompare(b));
  const hidden = HIDDEN_VIEWS.find((v) => v.value === query.view);
  const views = hidden ? [...REGISTER_VIEWS, hidden] : REGISTER_VIEWS;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Reminders"
        subtitle="Every date PocketMinder is keeping for you."
        action={
          <ButtonLink href={space?`/reminders/new?space=${space}`:"/reminders/new"} variant="secondary">
            <Plus className="size-4" /> Add reminder
          </ButtonLink>
        }
      />
      <Suspense>
        <RegisterControls
          query={query}
          categories={categories}
          people={people}
          counts={counts}
          views={views}
        />
      </Suspense>
      <div className="mt-6">
        {all.length === 0 ? (
          <EmptyNote>Nothing here yet. Use “Remember Something” to add your first date.</EmptyNote>
        ) : results.length === 0 ? (
          <EmptyNote>No reminders match. Try a different view, search or filter.</EmptyNote>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-1 shadow-card sm:p-2">
            <ReminderList reminders={results} />
          </div>
        )}
        {results.length > 0 && (
          <p className="mt-3 px-1 text-[13px] text-ink-3">
            {results.length} reminder{results.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );
}
