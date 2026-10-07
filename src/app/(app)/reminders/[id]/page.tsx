import clsx from "clsx";
import { ArrowLeft, BellOff, Check, Clock, RefreshCw, Repeat } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Attachments } from "@/components/reminders/Attachments";
import { StatusPill, Timeline } from "@/components/reminders/display";
import { ReminderActions } from "@/components/reminders/ReminderActions";
import { Card, toneText } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import {
  addDays,
  formatDisplay,
  formatLong,
  formatMedium,
  formatTimestamp,
  todayISO,
} from "@/lib/dates";
import {
  offsetLabel,
  PRIORITIES,
  recurrenceLabel,
  reminderTypeLabel,
} from "@/lib/domain";
import { countdown, escalationMessage, STATUS_TONE } from "@/lib/status";
import type { NotificationView } from "@/lib/types";
import { getReminderDetail, NotFoundError, suggestedRenewalDate } from "@/server/reminders";

export async function generateMetadata() {
  return { title: "Reminder" };
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={clsx("p-5 sm:p-6", className)}>
      <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3">
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2.5 last:border-0">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="text-right text-[14px] font-medium text-ink">{children}</dd>
    </div>
  );
}

const NOTIF_STATUS: Record<NotificationView["status"], string> = {
  pending: "Scheduled",
  sent: "Sent",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

const HISTORY_LABEL: Record<string, string> = {
  created: "Created",
  updated: "Edited",
  snoozed: "Snoozed",
  unsnoozed: "Snooze cancelled",
  renewed: "Renewed",
  resolved: "Resolved",
  reopened: "Reopened",
  archived: "Archived",
  restored: "Restored",
  attachment_added: "Attachment added",
  attachment_removed: "Attachment removed",
};

export default async function ReminderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const today = todayISO(user.timezone);
  let detail;
  try {
    detail = getReminderDetail(user.id, id, today);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { reminder: r, notifications, attachments, renewals, history, periods } = detail;
  const tone = STATUS_TONE[r.status];
  const c = countdown(r.daysRemaining);
  const active = r.lifecycle === "active";
  const prepStart = r.offsets.length ? addDays(r.importantDate, -Math.max(...r.offsets)) : null;
  const currentPeriod = periods[0]?.id ?? null;
  const visibleNotifications = notifications.filter((n) => n.status !== "cancelled");

  return (
    <div className="animate-fade-up space-y-6">
      <Link
        href="/reminders"
        className="-ml-1 inline-flex items-center gap-1.5 rounded-full px-1 text-[13px] font-medium text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> All reminders
      </Link>

      {/* Hero */}
      <Card className="overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-3">
          {r.category && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: r.category.color }} />
              {r.category.name}
            </span>
          )}
          <span>·</span>
          <span>{reminderTypeLabel(r.reminderType)}</span>
          {r.cycle > 1 && (
            <>
              <span>·</span>
              <span>Period {r.cycle}</span>
            </>
          )}
          <StatusPill status={r.status} className="ml-auto" />
        </div>

        <div className="mt-6 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="min-w-0">
            <h1 className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ink-2">
              {r.title}
            </h1>
            <p className="font-display mt-2 text-4xl font-medium tracking-tight text-ink sm:text-5xl">
              {formatDisplay(r.importantDate)}
            </p>
            {r.associatedWith && <p className="mt-2 text-[15px] text-ink-2">{r.associatedWith}</p>}
          </div>
          {active ? (
            <div className={clsx("sm:text-right", toneText[tone])}>
              <p className="font-display text-7xl font-medium leading-none tabular sm:text-8xl">
                {c.value}
              </p>
              {c.unit && (
                <p className="mt-2 text-[13px] font-semibold uppercase tracking-[0.14em]">{c.unit}</p>
              )}
            </div>
          ) : (
            <div className={clsx("flex items-center gap-2 text-lg font-medium", toneText[tone])}>
              {r.lifecycle === "renewed" ? (
                <RefreshCw className="size-5" />
              ) : (
                <Check className="size-5" />
              )}
              {escalationMessage(r.daysRemaining, r.lifecycle)}
            </div>
          )}
        </div>

        {active && (
          <>
            <p className={clsx("mt-6 text-[17px] font-medium", toneText[tone])}>
              {escalationMessage(r.daysRemaining)}
            </p>
            <div className="mt-6">
              <Timeline
                today={today}
                importantDate={r.importantDate}
                prepStart={prepStart}
                status={r.status}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-[14px]">
              <span className="text-ink-3">
                Next reminder:{" "}
                <span className="font-medium text-ink">
                  {r.snoozedUntil
                    ? formatLong(r.snoozedUntil)
                    : r.nextNotificationDate
                      ? formatLong(r.nextNotificationDate)
                      : r.daysRemaining < 0
                        ? "Weekly until resolved"
                        : "None scheduled"}
                </span>
              </span>
              {r.recurrence && (
                <span className="inline-flex items-center gap-1.5 text-ink-3">
                  <Repeat className="size-4" /> {recurrenceLabel(r.recurrence)}
                </span>
              )}
            </div>
          </>
        )}

        {r.snoozedUntil && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-info-bg p-4 text-[14px] text-info">
            <BellOff className="mt-0.5 size-4 shrink-0" />
            <p>
              Notifications snoozed until <strong>{formatLong(r.snoozedUntil)}</strong>. The{" "}
              {r.reminderType === "expiry" ? "expiry" : "important"} date has not changed.
            </p>
          </div>
        )}

        <div className="mt-6 border-t border-line pt-5">
          <ReminderActions
            r={r}
            suggestedRenewal={suggestedRenewalDate(r)}
            currentPeriodId={currentPeriod}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Section title="Details">
            <dl>
              <Detail label="Status">
                <StatusPill status={r.status} />
              </Detail>
              <Detail label="Important date">{formatLong(r.importantDate)}</Detail>
              {active && (
                <Detail label="Days remaining">
                  {r.daysRemaining >= 0
                    ? `${r.daysRemaining} day${r.daysRemaining === 1 ? "" : "s"}`
                    : `Overdue by ${-r.daysRemaining} day${r.daysRemaining === -1 ? "" : "s"}`}
                </Detail>
              )}
              <Detail label="Category">{r.category?.name ?? "—"}</Detail>
              <Detail label="Reminder type">{reminderTypeLabel(r.reminderType)}</Detail>
              <Detail label="Who / what">{r.associatedWith ?? "—"}</Detail>
              <Detail label="Priority">
                {PRIORITIES.find((p) => p.value === r.priority)?.label}
              </Detail>
              <Detail label="Repeats">{recurrenceLabel(r.recurrence)}</Detail>
              <Detail label="Created">{formatTimestamp(r.createdAt, user.timezone)}</Detail>
              {r.resolvedAt && (
                <Detail label="Resolved">{formatTimestamp(r.resolvedAt, user.timezone)}</Detail>
              )}
              {r.renewedAt && (
                <Detail label="Renewed">{formatTimestamp(r.renewedAt, user.timezone)}</Detail>
              )}
              {r.archivedAt && (
                <Detail label="Archived">{formatTimestamp(r.archivedAt, user.timezone)}</Detail>
              )}
            </dl>
          </Section>

          <Section title="Notes">
            {r.description ? (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                {r.description}
              </p>
            ) : (
              <p className="text-[14px] text-ink-3">
                No notes.{" "}
                <Link href={`/reminders/${r.id}/edit`} className="text-accent hover:underline">
                  Add some
                </Link>
              </p>
            )}
          </Section>

          <Section title="Attachments">
            <Attachments reminderId={r.id} attachments={attachments} />
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Reminder schedule">
            {r.offsets.length === 0 && visibleNotifications.length === 0 ? (
              <p className="text-[14px] text-ink-3">No advance reminders set.</p>
            ) : (
              <ul className="space-y-1">
                {visibleNotifications.map((n) => (
                  <li
                    key={n.id}
                    className={clsx(
                      "flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-[14px]",
                      n.status === "pending" ? "text-ink" : "text-ink-3",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {n.status === "sent" ? (
                        <Check className="size-4 text-done" />
                      ) : (
                        <Clock className="size-4 text-ink-3" />
                      )}
                      <span className="tabular">{formatMedium(n.scheduledFor)}</span>
                    </span>
                    <span className="text-[13px] text-ink-3">
                      {n.kind === "snooze"
                        ? "After snooze"
                        : n.kind === "overdue"
                          ? "Overdue follow-up"
                          : n.offsetDays !== null
                            ? offsetLabel(n.offsetDays)
                            : ""}{" "}
                      · {NOTIF_STATUS[n.status]}
                    </span>
                  </li>
                ))}
                {active && visibleNotifications.every((n) => n.status !== "pending") && (
                  <li className="px-2 pt-2 text-[13px] text-ink-3">
                    {r.daysRemaining < 0
                      ? "Overdue reminders resurface weekly until resolved."
                      : "All advance reminders have passed."}
                  </li>
                )}
              </ul>
            )}
          </Section>

          <Section title="Renewal history">
            {renewals.length === 0 && periods.length <= 1 ? (
              <p className="text-[14px] text-ink-3">
                No renewals yet. When you renew, the previous period stays on record here.
              </p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {periods.map((p) => {
                  const renewal = renewals.find((x) => x.fromReminderId === p.id);
                  const isThis = p.id === r.id;
                  return (
                    <li key={p.id} className="relative">
                      <span
                        className={clsx(
                          "absolute -left-[26px] top-1.5 size-2.5 rounded-full border-2 border-surface",
                          p.lifecycle === "active" ? "bg-accent" : "bg-line-strong",
                        )}
                      />
                      <Link
                        href={`/reminders/${p.id}`}
                        className={clsx(
                          "block rounded-lg text-[14px]",
                          isThis ? "font-semibold text-ink" : "text-ink-2 hover:text-ink",
                        )}
                      >
                        Period {p.cycle}: {formatLong(p.importantDate)}
                        <span className="ml-2 text-[12px] font-normal capitalize text-ink-3">
                          {p.lifecycle}
                          {isThis ? " · viewing" : ""}
                        </span>
                      </Link>
                      {renewal && (
                        <p className="text-[13px] text-ink-3">
                          {renewal.kind === "renewal" ? "Renewed" : "Completed"}{" "}
                          {formatTimestamp(renewal.renewedAt, user.timezone)} →{" "}
                          {formatMedium(renewal.newDate)}
                          {renewal.note ? ` · ${renewal.note}` : ""}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>

          <Section title="History">
            <ol className="space-y-3">
              {history.map((h) => (
                <li key={h.id} className="text-[14px]">
                  <p className="text-ink">
                    <span className="font-medium">{HISTORY_LABEL[h.event] ?? h.event}</span>
                    {h.detail && <span className="text-ink-2"> — {h.detail}</span>}
                  </p>
                  <p className="text-[12px] text-ink-3">
                    {formatTimestamp(h.createdAt, user.timezone)}
                    {h.reminderId !== r.id && " · other period"}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
