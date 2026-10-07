import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { getSpace } from "@/server/spaces";
import { listCategories, listReminders } from "@/server/reminders";
import { CalendarView } from "@/components/calendar/CalendarView";
import { PageHeader } from "@/components/ui/PageHeader";
export default async function SpaceCalendar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await requireUser();
  let s;
  try {
    s = getSpace(u.id, id);
  } catch {
    notFound();
  }
  const today = todayISO(u.timezone);
  return (
    <>
      <PageHeader
        title={`${s.name} Calendar`}
        back={{ href: `/spaces/${id}`, label: "Space" }}
      />
      <CalendarView
        today={today}
        reminders={listReminders(u.id, today, {
          spaceId: id,
          includeArchivedSpaces: true,
        })}
        categories={listCategories(u.id, id)}
      />
    </>
  );
}
