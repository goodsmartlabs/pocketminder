"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createReminderAction, updateReminderAction } from "@/app/actions/reminders";
import {
  applyDraftChange,
  draftFromParsed,
  draftToInput,
  emptyDraft,
  type ReminderDraft,
} from "@/lib/draft";
import { parseReminder } from "@/lib/parser";
import { useApp } from "../shell/AppContext";
import { Button, ButtonLink, Card } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { ReminderFields } from "./ReminderFields";

export function ReminderForm({
  mode,
  reminderId,
  initial,
  prefillText,
  spaceId,
}: {
  mode: "create" | "edit";
  reminderId?: string;
  initial?: ReminderDraft;
  prefillText?: string;
  spaceId?: string;
}) {
  const { today, dayFirst, categories, defaultOffsets } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<ReminderDraft>(() => {
    if (initial) return initial;
    if (prefillText)
      return {...draftFromParsed(parseReminder(prefillText, { today, dayFirst }), categories), spaceId:spaceId??"",categoryId:""};
    return {...emptyDraft(categories, defaultOffsets), spaceId: spaceId ?? "", categoryId: ""};
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof ReminderDraft>(key: K, value: ReminderDraft[K]) => {
    setDraft((d) => applyDraftChange(d, key, value));
    setErrors((e) => {
      const { [key as string]: _removed, ...rest } = e;
      void _removed;
      return rest;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!draft.title.trim()) clientErrors.title = "What do you need to remember?";
    if (!draft.importantDate) clientErrors.importantDate = "Please choose the important date.";
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      return;
    }
    startTransition(async () => {
      const input = draftToInput(draft);
      const result =
        mode === "edit" && reminderId
          ? await updateReminderAction(reminderId, input)
          : await createReminderAction(input, "manual");
      if (result.ok) {
        toast.show(result.message ?? "Saved.");
        router.push(`/reminders/${result.data?.id ?? reminderId}`);
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.show(result.error, "error");
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      {prefillText && mode === "create" && (
        <p className="mb-4 flex items-center gap-2 text-sm text-ink-2">
          <Sparkles className="size-4 text-accent" />
          Filled in from “{prefillText}”. Check the details below.
        </p>
      )}
      <Card className="p-5 sm:p-7">
        <ReminderFields
          draft={draft}
          set={set}
          categories={categories}
          today={today}
          errors={errors}
        />
      </Card>
      <div className="sticky bottom-20 z-20 mt-6 flex justify-end gap-2 lg:bottom-4">
        <ButtonLink
          href={mode === "edit" && reminderId ? `/reminders/${reminderId}` : "/"}
          variant="secondary"
          size="lg"
        >
          Cancel
        </ButtonLink>
        <Button type="submit" size="lg" loading={pending} className="min-w-[160px]">
          {mode === "edit" ? "Save changes" : "Remember this"}
        </Button>
      </div>
    </form>
  );
}
