"use client";

import clsx from "clsx";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "./AppContext";

const POLL_MS = 60_000;

interface BrowserItem {
  deliveryId: string;
  reminderId: string;
  title: string | null;
  body: string | null;
}

const NotificationCtx = createContext<{ unread: number; refresh: () => void } | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationCtx);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}

function showBrowserNotifications(items: BrowserItem[], onOpen: (url: string) => void) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  // Avoid a burst: several at once become one summary notification.
  if (items.length > 1) {
    const n = new Notification(`${items.length} dates need your attention`, {
      body: items.map((i) => i.title).filter(Boolean).slice(0, 4).join(" · "),
      tag: "pocketminder-summary",
      icon: "/icon.svg",
    });
    n.onclick = () => {
      window.focus();
      onOpen("/notifications");
      n.close();
    };
    return;
  }
  const item = items[0];
  const n = new Notification(item.title ?? "PocketMinder", {
    body: item.body ?? undefined,
    tag: `pocketminder-${item.reminderId}`,
    icon: "/icon.svg",
  });
  n.onclick = () => {
    window.focus();
    onOpen(`/reminders/${item.reminderId}`);
    n.close();
  };
}

/**
 * Polls the server while PocketMinder is open: runs the notification
 * scheduler, keeps the bell badge fresh and shows browser notifications.
 */
export function NotificationProvider({
  initialUnread,
  children,
}: {
  initialUnread: number;
  children: React.ReactNode;
}) {
  const { browserNotifications } = useApp();
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [seenInitial, setSeenInitial] = useState(initialUnread);
  if (seenInitial !== initialUnread) {
    // Server re-rendered with a fresher count.
    setSeenInitial(initialUnread);
    setUnread(initialUnread);
  }
  const inFlight = useRef(false);
  const browserRef = useRef(browserNotifications);
  useEffect(() => {
    browserRef.current = browserNotifications;
  }, [browserNotifications]);

  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/notifications/poll", { cache: "no-store" });
      if (!res.ok) return;
      const data: { sent: number; unread: number; browser: BrowserItem[] } = await res.json();
      setUnread(data.unread);
      if (data.browser.length) {
        if (browserRef.current) showBrowserNotifications(data.browser, (url) => router.push(url));
        await fetch("/api/notifications/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveryIds: data.browser.map((b) => b.deliveryId) }),
        });
      }
      if (data.sent > 0) router.refresh();
    } catch {
      // Offline or server restarting; try again next tick.
    } finally {
      inFlight.current = false;
    }
  }, [router]);

  useEffect(() => {
    const first = setTimeout(poll, 0);
    const id = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  const value = useMemo(() => ({ unread, refresh: poll }), [unread, poll]);
  return <NotificationCtx value={value}>{children}</NotificationCtx>;
}

export function NotificationBell({ className }: { className?: string }) {
  const { unread } = useNotifications();
  return (
    <Link
      href="/notifications"
      className={clsx(
        "relative inline-flex size-10 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
        className,
      )}
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold leading-4 text-white tabular">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
