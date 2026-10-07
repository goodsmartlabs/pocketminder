import { ReminderForm } from "@/components/reminders/ReminderForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Add reminder" };

export default async function NewReminderPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; space?: string }>;
}) {
  const { q, space } = await searchParams;
  return (
    <div className="animate-fade-up mx-auto max-w-2xl">
      <PageHeader
        title="Add a reminder"
        subtitle="Tell PocketMinder once. It will keep watch from here."
        back={{ href: "/", label: "Home" }}
      />
      <ReminderForm spaceId={space} mode="create" prefillText={q?.slice(0, 500) || undefined} />
    </div>
  );
}
