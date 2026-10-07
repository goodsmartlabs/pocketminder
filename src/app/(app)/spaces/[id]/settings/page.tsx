import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { getSpace } from "@/server/spaces";
import { CategoriesSection } from "@/components/settings/SettingsForms";
import { listCategories, listReminders } from "@/server/reminders";
import { SpaceForm, SpaceManagement } from "@/components/spaces/SpaceForms";
import { PageHeader } from "@/components/ui/PageHeader";
export default async function SpaceSettings({
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
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={`${s.name} settings`}
        back={{ href: `/spaces/${id}`, label: "Space" }}
      />
      <SpaceForm space={s} />
      <CategoriesSection
        categories={listCategories(u.id, id)}
        initialSpaceId={id}
      />
      <SpaceManagement
        space={s}
        count={
          listReminders(u.id, todayISO(u.timezone), {
            spaceId: id,
            includeArchivedSpaces: true,
          }).length
        }
      />
    </div>
  );
}
