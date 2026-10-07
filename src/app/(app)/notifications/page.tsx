import { NotificationInbox } from "@/components/shell/NotificationInbox";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth";
import { listInbox, processDueNotifications } from "@/server/notifications";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  await processDueNotifications(user.id, user.timezone);
  const items = listInbox(user.id);
  return (
    <div className="animate-fade-up mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        subtitle="Gentle nudges as your important dates get closer."
      />
      <NotificationInbox items={items} timezone={user.timezone} />
    </div>
  );
}
