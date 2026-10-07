import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { AppContextProvider } from "@/components/shell/AppContext";
import { MobileHeader, MobileNav, Sidebar, TopBar } from "@/components/shell/Navigation";
import { NotificationProvider } from "@/components/shell/Notifications";
import { QuickCaptureProvider } from "@/components/shell/QuickCapture";
import { ToastProvider } from "@/components/ui/Toast";
import { unreadCount } from "@/server/notifications";
import { getSettings, listCategories } from "@/server/reminders";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = getSettings(user.id);
  const categories = listCategories(user.id);

  return (
    <AppContextProvider
      value={{
        userName: user.name,
        today: todayISO(user.timezone),
        timezone: user.timezone,
        dayFirst: settings.dayFirst,
        categories,
        defaultOffsets: settings.defaultOffsets,
        browserNotifications: settings.browserEnabled,
      }}
    >
      <ToastProvider>
        <NotificationProvider initialUnread={unreadCount(user.id)}>
          <QuickCaptureProvider>
            <div className="flex min-h-dvh">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <MobileHeader />
                <Suspense fallback={<div className="hidden h-16 lg:block" />}>
                  <TopBar />
                </Suspense>
                <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
                  {children}
                </main>
              </div>
            </div>
            <MobileNav />
          </QuickCaptureProvider>
        </NotificationProvider>
      </ToastProvider>
    </AppContextProvider>
  );
}
