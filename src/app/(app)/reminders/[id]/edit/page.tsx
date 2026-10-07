import { notFound } from "next/navigation";
import { ReminderForm } from "@/components/reminders/ReminderForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { draftFromReminder } from "@/lib/draft";
import { getReminderDetail, NotFoundError } from "@/server/reminders";

export const metadata = { title: "Edit reminder" };

export default async function EditReminderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  let detail;
  try {
    detail = getReminderDetail(user.id, id, todayISO(user.timezone));
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  return (
    <div className="animate-fade-up mx-auto max-w-2xl">
      <PageHeader
        title="Edit reminder"
        subtitle={detail.reminder.title}
        back={{ href: `/reminders/${id}`, label: "Back to reminder" }}
      />
      <ReminderForm mode="edit" reminderId={id} initial={draftFromReminder(detail.reminder)} />
    </div>
  );
}
