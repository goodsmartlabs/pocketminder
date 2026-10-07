import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { getSpace } from "@/server/spaces";
import { listReminders } from "@/server/reminders";
import { buildDashboard } from "@/lib/dashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink, Card, SectionHeader } from "@/components/ui/primitives";
import { ReminderList } from "@/components/reminders/display";
export default async function SpacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  let space;
  try {
    space = getSpace(user.id, id);
  } catch {
    notFound();
  }
  const all = listReminders(user.id, todayISO(user.timezone), {
    spaceId: id,
    includeArchivedSpaces: true,
  });
  const active = all.filter((r) => r.lifecycle === "active");
  const d = buildDashboard(all);
  const critical =
    active.find(
      (r) => r.daysRemaining >= 0 && ["critical", "high"].includes(r.priority),
    ) ?? d.next;
  const attention = active.filter((r) =>
    ["needs_attention", "urgent", "due_today", "overdue"].includes(r.status),
  );
  return (
    <div className="space-y-7">
      <PageHeader
        title={space.name}
        subtitle={
          space.description ||
          `Everything you need to remember for ${space.name}.`
        }
        action={
          space.status === "active" ? (
            <ButtonLink href={`/reminders/new?space=${id}`}>
              + Add Reminder
            </ButtonLink>
          ) : undefined
        }
      />
      {space.status === "archived" && (
        <p>
          This Space is archived. Its dates, history, notes and attachments are
          retained; notifications are paused.
        </p>
      )}
      <nav className="flex flex-wrap gap-4">
        <Link href={`/spaces/${id}`}>Dashboard</Link>
        <Link href={`/spaces/${id}/calendar`}>Calendar</Link>
        <Link href={`/reminders?space=${id}`}>Reminders</Link>
        <Link href={`/spaces/${id}/settings`}>Settings</Link>
      </nav>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Needs Attention", attention.length],
          ["Next 7 Days", d.counts.next7],
          ["Next 30 Days", d.counts.next30],
          ["Overdue", d.counts.overdue],
        ].map(([label, n]) => (
          <Card key={label} className="p-4">
            <p>{label}</p>
            <p className="text-3xl">{n}</p>
          </Card>
        ))}
      </div>
      <Card className="space-y-3 p-5">
        <h2 className="text-xl">Space Overview</h2>
        <p>
          {active.length} Active ·{" "}
          {active.filter((r) => r.status === "safe").length} Safe ·{" "}
          {active.filter((r) => r.status === "upcoming").length} Coming Up ·{" "}
          {active.filter((r) => r.status === "urgent").length} Urgent ·{" "}
          {d.counts.overdue} Overdue
        </p>
        <p>
          Next critical date: {critical?.title ?? "None"}{" "}
          {critical &&
            `· ${critical.importantDate} · ${critical.daysRemaining} days remaining`}
        </p>
      </Card>
      {!all.length && (
        <p>
          What should PocketMinder remember for you? Add your first reminder.
        </p>
      )}
      {[
        ["Needs Your Attention", attention],
        [
          "Coming Up",
          active.filter((r) => r.daysRemaining >= 0 && r.daysRemaining <= 90),
        ],
        ["Later", d.later],
      ].map(([title, items]) => (
        <section key={title as string}>
          <SectionHeader title={title as string} />
          <ReminderList reminders={items as typeof active} />
        </section>
      ))}
    </div>
  );
}
