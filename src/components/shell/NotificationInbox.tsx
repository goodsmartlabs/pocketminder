"use client";

import clsx from "clsx";
import { BellRing } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { markNotificationsReadAction } from "@/app/actions/settings";
import { formatTimestamp } from "@/lib/dates";
import type { NotificationView } from "@/lib/types";
import { EmptyNote } from "../reminders/display";
import { Button } from "../ui/primitives";
import { useNotifications } from "./Notifications";

export function NotificationInbox({
  items,
  timezone,
}: {
  items: NotificationView[];
  timezone: string;
}) {
  const router = useRouter();
  const { refresh } = useNotifications();
  const [pending, start] = useTransition();
  const unread = items.filter((i) => !i.readAt);

  // Opening the inbox counts as seeing everything in it (after a short pause).
  useEffect(() => {
    if (unread.length === 0) return;
    const t = setTimeout(() => {
      start(async () => {
        await markNotificationsReadAction("all");
        refresh();
      });
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread.length]);

  if (items.length === 0) {
    return (
      <EmptyNote>
        No notifications yet. PocketMinder will nudge you here as dates approach.
      </EmptyNote>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] text-ink-3">{unread.length} unread</p>
        {unread.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                await markNotificationsReadAction("all");
                refresh();
                router.refresh();
              })
            }
          >
            Mark all read
          </Button>
        )}
      </div>
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id}>
            <Link
              href={`/reminders/${n.reminderId}`}
              className={clsx(
                "flex gap-4 rounded-2xl border p-4 transition-colors hover:border-line-strong",
                n.readAt ? "border-line bg-surface/60" : "border-line bg-surface shadow-card",
              )}
            >
              <span
                className={clsx(
                  "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                  n.kind === "overdue" ? "bg-critical-bg text-critical" : "bg-accent-soft text-accent",
                )}
              >
                <BellRing className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={clsx("text-[15px]", n.readAt ? "text-ink-2" : "font-semibold text-ink")}>
                  {n.title}
                </p>
                <p className="mt-0.5 text-[14px] text-ink-2">{n.body}</p>
                <p className="mt-1.5 text-[12px] text-ink-3">
                  {n.sentAt ? formatTimestamp(n.sentAt, timezone) : ""}
                </p>
              </div>
              {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
