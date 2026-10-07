import {
  AppearanceSection,
  CategoriesSection,
  PreferencesSection,
  ProfileSection,
  SecuritySection,
} from "@/components/settings/SettingsForms";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth";
import { getSettings, listCategories } from "@/server/reminders";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = getSettings(user.id);
  return (
    <div className="animate-fade-up mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="Make PocketMinder work the way you remember." />
      <ProfileSection name={user.name} email={user.email} timezone={user.timezone} />
      <PreferencesSection settings={settings} />
      <AppearanceSection />
      <CategoriesSection categories={listCategories(user.id)} />
      <SecuritySection />
    </div>
  );
}
