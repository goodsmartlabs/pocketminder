"use client";

import clsx from "clsx";
import { CalendarDays, Repeat, Sparkles, SlidersHorizontal, User2, Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createReminderAction } from "@/app/actions/reminders";
import { diffDays, formatLong } from "@/lib/dates";
import { offsetsSummary, recurrenceLabel, reminderTypeLabel } from "@/lib/domain";
import {
  applyDraftChange,
  draftFromParsed,
  draftRecurrence,
  draftToInput,
  type ReminderDraft,
} from "@/lib/draft";
import { parseReminder, QUICK_CAPTURE_EXAMPLES } from "@/lib/parser";
import { ReminderFields } from "../reminders/ReminderFields";
import { Modal } from "../ui/Modal";
import { Button, Input, Textarea } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { useApp } from "./AppContext";

const QuickCaptureContext = createContext<{ open: (text?: string) => void } | null>(null);

export function useQuickCapture() {
  const ctx = useContext(QuickCaptureContext);
  if (!ctx) throw new Error("useQuickCapture must be used inside QuickCaptureProvider");
  return ctx;
}

export function QuickCaptureProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; text: string; key: number }>({
    open: false,
    text: "",
    key: 0,
  });

  const open = useCallback((text = "") => {
    setState((s) => ({ open: true, text, key: s.key + 1 }));
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  // Press "n" anywhere (outside a text field) to capture something.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        e.key !== "n" ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        t?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")
      )
        return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <QuickCaptureContext value={value}>
      {children}
      <Modal
        open={state.open}
        onClose={close}
        title="Remember something"
        hideTitle
        size="lg"
      >
        <QuickCaptureBody key={state.key} initialText={state.text} onDone={close} />
      </Modal>
    </QuickCaptureContext>
  );
}

function QuickCaptureBody({ initialText, onDone }: { initialText: string; onDone: () => void }) {
  const { today, dayFirst, categories } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState(initialText);
  const [edits, setEdits] = useState<ReminderDraft | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);

  const parsed = useMemo(
    () => (text.trim() ? parseReminder(text, { today, dayFirst }) : null),
    [text, today, dayFirst],
  );
  const draft = useMemo(
    () => edits ?? (parsed ? draftFromParsed(parsed, categories) : null),
    [edits, parsed, categories],
  );

  const set = <K extends keyof ReminderDraft>(key: K, value: ReminderDraft[K]) => {
    if (!draft) return;
    setEdits(applyDraftChange(draft, key, value));
    setErrors((e) => ({ ...e, [key]: undefined as unknown as string }));
  };

  const onTextChange = (value: string) => {
    setText(value);
    setEdits(null); // re-derive from the new sentence
    setErrors({});
  };

  const save = () => {
    if (!draft) return;
    if (!draft.importantDate) {
      setErrors({ importantDate: "When is it? Pick the important date." });
      return;
    }
    startTransition(async () => {
      const result = await createReminderAction(draftToInput(draft), "quick_capture");
      if (result.ok) {
        toast.show(result.message ?? "Saved.");
        onDone();
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        if (result.fieldErrors && Object.keys(result.fieldErrors).some((k) => k !== "title"))
          setAdjusting(true);
        toast.show(result.error, "error");
      }
    });
  };

  const category = categories.find((c) => c.id === draft?.categoryId);
  const recurrence = draft ? draftRecurrence(draft) : null;
  const days = draft?.importantDate ? diffDays(today, draft.importantDate) : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-5"
    >
      <div>
        <label htmlFor="qc-text" className="font-display block text-2xl font-medium text-ink sm:text-[28px]">
          What do you need to remember?
        </label>
        <Textarea
          id="qc-text"
          ref={textRef}
          data-autofocus
          rows={2}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (draft) save();
            }
          }}
          placeholder="e.g. John's visa expires on 14 November 2026"
          className="mt-3 resize-none border-0 !bg-surface-2 !px-4 !py-3.5 text-[17px] focus:!ring-accent/15"
          maxLength={500}
        />
      </div>

      {!draft && (
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            Try something like
          </p>
          <div className="flex flex-col gap-1.5">
            {QUICK_CAPTURE_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  onTextChange(ex);
                  textRef.current?.focus();
                }}
                className="rounded-xl px-3 py-2 text-left text-[14px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                “{ex}”
              </button>
            ))}
          </div>
        </div>
      )}

      {draft && !adjusting && (
        <div className="animate-fade-up rounded-2xl border border-line bg-surface-2/60 p-4 sm:p-5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">
            <Sparkles className="size-3.5" /> Here&apos;s what I&apos;ll remember
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">{draft.title || "Untitled reminder"}</p>

          <dl className="mt-3 space-y-2 text-[14px]">
            <div className="flex items-start gap-2.5">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-ink-3" />
              <dt className="sr-only">Date</dt>
              <dd className="flex-1">
                {draft.importantDate ? (
                  <span className="text-ink">
                    <span className="font-medium">{formatLong(draft.importantDate)}</span>
                    <span className="text-ink-3">
                      {" "}
                      ·{" "}
                      {days === 0
                        ? "today"
                        : days! > 0
                          ? `in ${days} day${days === 1 ? "" : "s"}`
                          : `${-days!} days ago`}
                    </span>
                  </span>
                ) : (
                  <div className="space-y-1">
                    <span className="text-attention">I couldn&apos;t find a date. When is it?</span>
                    <Input
                      type="date"
                      value=""
                      onChange={(e) => set("importantDate", e.target.value)}
                      className="max-w-[220px]"
                      invalid={!!errors.importantDate}
                      aria-label="Important date"
                    />
                  </div>
                )}
              </dd>
            </div>
            <div className="flex items-start gap-2.5">
              <span
                className="mt-1.5 ml-1 size-2 shrink-0 rounded-full"
                style={{ backgroundColor: category?.color }}
                aria-hidden
              />
              <dt className="sr-only">Category and type</dt>
              <dd className="ml-0.5 text-ink-2">
                {category?.name ?? "No category"} · {reminderTypeLabel(draft.reminderType)}
                {draft.priority === "high" || draft.priority === "critical" ? " · High priority" : ""}
              </dd>
            </div>
            {draft.associatedWith && (
              <div className="flex items-start gap-2.5">
                <User2 className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <dt className="sr-only">Who or what</dt>
                <dd className="text-ink-2">{draft.associatedWith}</dd>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <Bell className="mt-0.5 size-4 shrink-0 text-ink-3" />
              <dt className="sr-only">Reminders</dt>
              <dd className="text-ink-2">
                {offsetsSummary(draft.offsets)}
              </dd>
            </div>
            {recurrence && (
              <div className="flex items-start gap-2.5">
                <Repeat className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <dt className="sr-only">Repeats</dt>
                <dd className="text-ink-2">{recurrenceLabel(recurrence)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {draft && adjusting && (
        <div className="animate-fade-up">
          <ReminderFields
            draft={draft}
            set={set}
            categories={categories}
            today={today}
            errors={errors}
            compact
          />
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={text.trim() ? `/reminders/new?q=${encodeURIComponent(text.trim())}` : "/reminders/new"}
          onClick={onDone}
          className="text-center text-[13px] font-medium text-ink-3 hover:text-ink sm:text-left"
        >
          Use the full form
        </Link>
        <div className="flex gap-2">
          {draft && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAdjusting((a) => !a)}
              className="flex-1 sm:flex-none"
            >
              <SlidersHorizontal className="size-4" />
              {adjusting ? "Done adjusting" : "Adjust"}
            </Button>
          )}
          <Button
            type="submit"
            loading={pending}
            disabled={!draft}
            className={clsx("flex-1 sm:flex-none sm:min-w-[140px]")}
          >
            Remember this
          </Button>
        </div>
      </div>
    </form>
  );
}
