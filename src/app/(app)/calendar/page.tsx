import { CalendarView } from "@/components/calendar/CalendarView";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { listCategories, listReminders } from "@/server/reminders";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({searchParams}:{searchParams:Promise<{space?:string}>}) {
  const {space}=await searchParams;
  const user = await requireUser();
  const today = todayISO(user.timezone);
  const reminders = listReminders(user.id, today, {
    spaceId: space,
    lifecycles: ["active", "resolved", "renewed"],
  });
  return (
    <div className="animate-fade-up">
      <PageHeader title="Calendar" subtitle="Your important dates, at a glance." />
      <CalendarView reminders={reminders} categories={listCategories(user.id,space)} today={today} />
    </div>
  );
}
