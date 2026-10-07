import { SpaceIcon } from "@/components/spaces/SpaceIcon";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { listSpaces } from "@/server/spaces";
import { listReminders } from "@/server/reminders";
import { buildDashboard } from "@/lib/dashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink, Card } from "@/components/ui/primitives";
export default async function SpacesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await requireUser();
  const archived = (await searchParams).archived === "1";
  const spaces = listSpaces(user.id, archived);
  const reminders = listReminders(user.id, todayISO(user.timezone), {
    includeArchivedSpaces: true,
  });
  return (
    <div>
      <PageHeader
        title={archived ? "Archived Spaces" : "Minder Spaces"}
        subtitle="Your brain has compartments. Everything has a Space."
        action={
          <ButtonLink href="/spaces/new">+ Create Minder Space</ButtonLink>
        }
      />
      <div className="mb-5 flex gap-4">
        <Link href="/spaces">Active Spaces</Link>
        <Link href="/spaces?archived=1">Archived Spaces</Link>
      </div>
      {!spaces.length && (
        <p>No {archived ? "archived" : "active"} Spaces yet.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {spaces.map((s) => {
          const items = reminders.filter((r) => r.spaceId === s.id);
          const d = buildDashboard(items);
          return (
            <Link key={s.id} href={`/spaces/${s.id}`}>
              <Card className="space-y-3 p-5">
                <h2 className="text-xl font-semibold">
                  <SpaceIcon icon={s.icon} color={s.color} /> {s.name}
                </h2>
                <p className="text-sm text-ink-3">{s.description}</p>
                <p>
                  {items.filter((r) => r.lifecycle === "active").length} Active
                  Reminders · {d.counts.needsAttention + d.counts.overdue} Need
                  Attention
                </p>
                <p>
                  Next:{" "}
                  {d.next
                    ? `${d.next.title} — ${d.next.daysRemaining} days`
                    : "No upcoming dates"}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
