import clsx from "clsx";
import { AlertTriangle, CalendarClock, CalendarRange, Sparkle } from "lucide-react";
import Link from "next/link";
import { CaptureBar, EmptyHome } from "@/components/home/CaptureBar";
import {
  EmptyNote,
  HeroReminder,
  ReminderList,
} from "@/components/reminders/display";
import { SectionHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { buildDashboard, greeting } from "@/lib/dashboard";
import { currentHour, formatWeekday, formatLong, todayISO } from "@/lib/dates";
import { listReminders } from "@/server/reminders";

export const metadata = { title: "Home" };

function SummaryCard({
  href,
  label,
  value,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "attention" | "info" | "calm" | "critical";
}) {
  const active = value > 0;
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-pop sm:p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <Icon
          className={clsx(
            "size-4",
            !active && "text-ink-3",
            active && tone === "attention" && "text-attention",
            active && tone === "info" && "text-info",
            active && tone === "calm" && "text-calm",
            active && tone === "critical" && "text-critical",
          )}
        />
      </div>
      <p
        className={clsx(
          "font-display mt-3 text-4xl font-medium leading-none tabular",
          active && tone === "critical" ? "text-critical" : active ? "text-ink" : "text-ink-3",
        )}
      >
        {value}
      </p>
    </Link>
  );
}

export default async function HomePage() {
  const user = await requireUser();
  const today = todayISO(user.timezone);
  const all = listReminders(user.id, today);

  if (all.length === 0) return <EmptyHome name={user.name.split(" ")[0]} />;

  const d = buildDashboard(all);
  const firstName = user.name.split(" ")[0];
  const calm = d.counts.overdue === 0 && d.today.length === 0;

  return (
    <div className="animate-fade-up space-y-10">
      <section>
        <p className="text-[13px] font-medium text-ink-3">
          {formatWeekday(today)}, {formatLong(today)}
        </p>
        <h1 className="font-display mt-1 text-[34px] font-medium leading-tight tracking-tight text-ink sm:text-[42px]">
          {greeting(currentHour(user.timezone))}, {firstName}.
        </h1>
        <p className="mt-1 text-[17px] text-ink-2">
          {calm
            ? "Nothing needs you today. Here's what PocketMinder is holding for you."
            : "Here's what you need to remember."}
        </p>
        <div className="mt-6">
          <CaptureBar />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          href="/reminders?view=attention"
          label="Needs attention"
          value={d.counts.needsAttention}
          icon={Sparkle}
          tone="attention"
        />
        <SummaryCard
          href="/reminders?view=next7"
          label="Next 7 days"
          value={d.counts.next7}
          icon={CalendarClock}
          tone="info"
        />
        <SummaryCard
          href="/reminders?view=next30"
          label="Next 30 days"
          value={d.counts.next30}
          icon={CalendarRange}
          tone="calm"
        />
        <SummaryCard
          href="/reminders?view=overdue"
          label="Overdue"
          value={d.counts.overdue}
          icon={AlertTriangle}
          tone="critical"
        />
      </section>

      {d.next && (
        <section>
          <HeroReminder
            r={d.next}
            label={d.next.daysRemaining === 0 ? "Due today" : "Next up"}
          />
        </section>
      )}

      {d.overdue.length > 0 && (
        <section>
          <SectionHeader title="Overdue" count={d.overdue.length} />
          <div className="rounded-2xl border border-critical/25 bg-surface p-1 shadow-card sm:p-2">
            <ReminderList reminders={d.overdue} />
          </div>
          <p className="mt-2 px-1 text-[13px] text-ink-3">
            These stay here until you resolve or renew them.
          </p>
        </section>
      )}

      <section>
        <SectionHeader title="Today" count={d.today.length || undefined} />
        {d.today.length > 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-1 shadow-card sm:p-2">
            <ReminderList reminders={d.today} />
          </div>
        ) : (
          <EmptyNote>Nothing needs your attention today. Enjoy the quiet.</EmptyNote>
        )}
      </section>

      <section>
        <SectionHeader
          title="Coming up"
          count={d.comingUp.length || undefined}
          action={
            <Link href="/calendar" className="text-[13px] font-medium text-accent hover:underline">
              Calendar
            </Link>
          }
        />
        {d.comingUp.length > 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-1 shadow-card sm:p-2">
            <ReminderList reminders={d.comingUp} />
          </div>
        ) : (
          <EmptyNote>Nothing in the next 90 days.</EmptyNote>
        )}
      </section>

      {d.later.length > 0 && (
        <section>
          <SectionHeader
            title="Later"
            count={d.later.length}
            action={
              d.later.length > 5 ? (
                <Link
                  href="/reminders?view=upcoming&sort=closest"
                  className="text-[13px] font-medium text-accent hover:underline"
                >
                  View all
                </Link>
              ) : undefined
            }
          />
          <div className="rounded-2xl border border-line bg-surface/60 p-1 sm:p-2">
            <ReminderList reminders={d.later.slice(0, 5)} showStatus={false} />
          </div>
          <p className="mt-2 px-1 text-[13px] text-ink-3">Safely further away. Nothing to do yet.</p>
        </section>
      )}
    </div>
  );
}
