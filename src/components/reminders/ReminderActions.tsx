"use client";

import {
  Archive,
  ArchiveRestore,
  BellOff,
  Check,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  archiveAction,
  deleteReminderAction,
  renewAction,
  reopenAction,
  resolveAction,
  snoozeAction,
  unarchiveAction,
  unsnoozeAction,
} from "@/app/actions/reminders";
import { addDays, formatLong, formatShort, type ISODate } from "@/lib/dates";
import { RENEWABLE_TYPES } from "@/lib/domain";
import type { ActionResult, ReminderView } from "@/lib/types";
import { useApp } from "../shell/AppContext";
import { Modal } from "../ui/Modal";
import { Button, ButtonLink, Field, Input } from "../ui/primitives";
import { useToast } from "../ui/Toast";

function useRun() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = <T,>(
    fn: () => Promise<ActionResult<T>>,
    after?: (r: Extract<ActionResult<T>, { ok: true }>) => void,
  ) =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        if (result.message) toast.show(result.message);
        after?.(result);
        router.refresh();
      } else {
        toast.show(result.error, "error");
      }
    });
  return { run, pending };
}

/* ------------------------------------------------------------------ */
/* Snooze                                                              */
/* ------------------------------------------------------------------ */

function SnoozeDialog({
  r,
  open,
  onClose,
}: {
  r: ReminderView;
  open: boolean;
  onClose: () => void;
}) {
  const { today } = useApp();
  const { run, pending } = useRun();
  const [custom, setCustom] = useState(addDays(today, 14));
  const options: { label: string; date: ISODate }[] = [
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: "In 3 days", date: addDays(today, 3) },
    { label: "In 1 week", date: addDays(today, 7) },
  ];
  const snooze = (date: ISODate) => run(() => snoozeAction(r.id, date), onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Snooze notifications"
      description={
        <>
          The important date stays <strong>{formatLong(r.importantDate)}</strong>. Only the
          notifications pause.
        </>
      }
      size="sm"
    >
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            disabled={pending}
            onClick={() => snooze(o.date)}
            className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left text-[15px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-2 disabled:opacity-50"
          >
            {o.label}
            <span className="text-[13px] font-normal text-ink-3">{formatShort(o.date)}</span>
          </button>
        ))}
        <div className="flex items-end gap-2 pt-3">
          <Field label="Custom date" htmlFor="snooze-custom" className="flex-1">
            <Input
              id="snooze-custom"
              type="date"
              min={addDays(today, 1)}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </Field>
          <Button
            type="button"
            variant="secondary"
            onClick={() => custom && snooze(custom)}
            loading={pending}
            className="h-11"
          >
            Snooze
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Renew                                                               */
/* ------------------------------------------------------------------ */

function RenewDialog({
  r,
  suggested,
  open,
  onClose,
}: {
  r: ReminderView;
  suggested: ISODate;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { run, pending } = useRun();
  const [newDate, setNewDate] = useState(suggested);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return setError("What is the new date?");
    if (newDate <= r.importantDate) return setError("The new date must be after the old one.");
    setError(null);
    run(
      () => renewAction(r.id, newDate, note || null),
      (res) => {
        onClose();
        if (res.data?.id) router.push(`/reminders/${res.data.id}`);
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Renew ${r.title}`}
      description="PocketMinder keeps this period on record and starts tracking the next one."
      size="sm"
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            Old {r.reminderType === "expiry" ? "expiry" : "date"}
          </p>
          <p className="font-display mt-1 text-xl text-ink-2 line-through decoration-ink-3/60">
            {formatLong(r.importantDate)}
          </p>
        </div>
        <Field
          label={`What is the new ${r.reminderType === "expiry" ? "expiry " : ""}date?`}
          htmlFor="renew-date"
          error={error ?? undefined}
        >
          <Input
            id="renew-date"
            type="date"
            data-autofocus
            value={newDate}
            min={addDays(r.importantDate, 1)}
            onChange={(e) => setNewDate(e.target.value)}
            invalid={!!error}
          />
        </Field>
        <Field label="Note" htmlFor="renew-note" optional hint="e.g. new passport number ends 4821">
          <Input
            id="renew-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          <RefreshCw className="size-4" /> Renew and start next cycle
        </Button>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

function DeleteDialog({
  r,
  open,
  onClose,
}: {
  r: ReminderView;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { run, pending } = useRun();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete this reminder?"
      description="This permanently removes it, with its notifications and attachments. Archive it instead if you might want it later."
      size="sm"
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Keep it
        </Button>
        <Button
          variant="danger"
          loading={pending}
          onClick={() =>
            run(
              () => deleteReminderAction(r.id),
              () => {
                onClose();
                router.push("/reminders");
              },
            )
          }
        >
          <Trash2 className="size-4" /> Delete permanently
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Overflow menu                                                       */
/* ------------------------------------------------------------------ */

function MoreMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        className="!px-3"
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open && (
        <div
          role="menu"
          className="animate-fade absolute right-0 top-12 z-30 w-52 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  icon: Icon,
  children,
  danger,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium hover:bg-surface-2 ${danger ? "text-critical" : "text-ink"}`}
    >
      <Icon className="size-4 opacity-70" />
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Action bar                                                          */
/* ------------------------------------------------------------------ */

export function ReminderActions({
  r,
  suggestedRenewal,
  currentPeriodId,
}: {
  r: ReminderView;
  suggestedRenewal: ISODate;
  currentPeriodId: string | null;
}) {
  const [dialog, setDialog] = useState<null | "snooze" | "renew" | "delete">(null);
  const { run, pending } = useRun();
  const close = () => setDialog(null);
  const renewable = RENEWABLE_TYPES.includes(r.reminderType) || !!r.recurrence;
  const active = r.lifecycle === "active";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {active && renewable && (
          <Button onClick={() => setDialog("renew")}>
            <RefreshCw className="size-4" /> Renew
          </Button>
        )}
        {active && (
          <Button
            variant={renewable ? "secondary" : "primary"}
            loading={pending}
            onClick={() => run(() => resolveAction(r.id))}
          >
            <Check className="size-4" />
            {r.recurrence ? "Done — schedule next" : "Mark resolved"}
          </Button>
        )}
        {active &&
          (r.snoozedUntil ? (
            <Button variant="secondary" onClick={() => run(() => unsnoozeAction(r.id))}>
              <BellOff className="size-4" /> Cancel snooze
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setDialog("snooze")}>
              <BellOff className="size-4" /> Snooze
            </Button>
          ))}
        {r.lifecycle === "resolved" && (
          <Button variant="secondary" onClick={() => run(() => reopenAction(r.id))}>
            <RotateCcw className="size-4" /> Reopen
          </Button>
        )}
        {r.lifecycle === "archived" && (
          <Button onClick={() => run(() => unarchiveAction(r.id))}>
            <ArchiveRestore className="size-4" /> Restore
          </Button>
        )}
        {currentPeriodId && currentPeriodId !== r.id && (
          <ButtonLink href={`/reminders/${currentPeriodId}`} variant="soft">
            View current period
          </ButtonLink>
        )}
        <ButtonLink href={`/reminders/${r.id}/edit`} variant="secondary">
          <Pencil className="size-4" /> Edit
        </ButtonLink>
        <MoreMenu>
          {r.lifecycle !== "archived" && (
            <MenuItem icon={Archive} onClick={() => run(() => archiveAction(r.id))}>
              Archive
            </MenuItem>
          )}
          <MenuItem icon={Trash2} danger onClick={() => setDialog("delete")}>
            Delete
          </MenuItem>
        </MoreMenu>
      </div>

      <SnoozeDialog r={r} open={dialog === "snooze"} onClose={close} />
      <RenewDialog r={r} suggested={suggestedRenewal} open={dialog === "renew"} onClose={close} />
      <DeleteDialog r={r} open={dialog === "delete"} onClose={close} />
    </>
  );
}
