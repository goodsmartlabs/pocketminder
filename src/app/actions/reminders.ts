"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";
import {
  fieldErrors,
  reminderInputSchema,
  renewSchema,
  snoozeSchema,
} from "@/lib/validation";
import {
  archiveReminder,
  createReminder,
  deleteAttachment,
  deleteReminder,
  NotFoundError,
  renewReminder,
  reopenReminder,
  resolveReminder,
  snoozeReminder,
  unarchiveReminder,
  unsnoozeReminder,
  updateReminder,
} from "@/server/reminders";

function refreshAll() {
  revalidatePath("/", "layout");
}

function failure(e: unknown): ActionResult<never> {
  if (e instanceof NotFoundError) return { ok: false, error: e.message };
  if (e instanceof Error && e.message && !e.message.includes("SQLITE")) {
    return { ok: false, error: e.message };
  }
  console.error(e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function context() {
  const user = await requireUser();
  return { user, today: todayISO(user.timezone) };
}

export async function createReminderAction(
  raw: unknown,
  source: "manual" | "quick_capture" = "manual",
): Promise<ActionResult<{ id: string }>> {
  const { user, today } = await context();
  const parsed = reminderInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errors)[0], fieldErrors: errors };
  }
  try {
    const id = createReminder(user.id, parsed.data, today, source);
    refreshAll();
    return { ok: true, data: { id }, message: "Saved. PocketMinder has it." };
  } catch (e) {
    return failure(e);
  }
}

export async function updateReminderAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { user, today } = await context();
  const parsed = reminderInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errors)[0], fieldErrors: errors };
  }
  try {
    updateReminder(user.id, id, parsed.data, today);
    refreshAll();
    return { ok: true, data: { id }, message: "Changes saved." };
  } catch (e) {
    return failure(e);
  }
}

export async function snoozeAction(id: string, until: string): Promise<ActionResult> {
  const { user, today } = await context();
  const parsed = snoozeSchema.safeParse({ until });
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error).until };
  try {
    snoozeReminder(user.id, id, parsed.data.until, today);
    refreshAll();
    return { ok: true, message: "Snoozed. The date itself hasn't changed." };
  } catch (e) {
    return failure(e);
  }
}

export async function unsnoozeAction(id: string): Promise<ActionResult> {
  const { user, today } = await context();
  try {
    unsnoozeReminder(user.id, id, today);
    refreshAll();
    return { ok: true, message: "Snooze cancelled." };
  } catch (e) {
    return failure(e);
  }
}

export async function renewAction(
  id: string,
  newDate: string,
  note?: string | null,
): Promise<ActionResult<{ id: string }>> {
  const { user, today } = await context();
  const parsed = renewSchema.safeParse({ newDate, note });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errors)[0], fieldErrors: errors };
  }
  try {
    const nextId = renewReminder(user.id, id, parsed.data.newDate, parsed.data.note, today);
    refreshAll();
    return { ok: true, data: { id: nextId }, message: "Renewed. The next cycle is set up." };
  } catch (e) {
    return failure(e);
  }
}

export async function resolveAction(id: string): Promise<ActionResult<{ id: string | null }>> {
  const { user, today } = await context();
  try {
    const { nextId } = resolveReminder(user.id, id, today);
    refreshAll();
    return {
      ok: true,
      data: { id: nextId },
      message: nextId ? "Done. The next occurrence is scheduled." : "Resolved. One less thing.",
    };
  } catch (e) {
    return failure(e);
  }
}

export async function reopenAction(id: string): Promise<ActionResult> {
  const { user, today } = await context();
  try {
    reopenReminder(user.id, id, today);
    refreshAll();
    return { ok: true, message: "Reopened." };
  } catch (e) {
    return failure(e);
  }
}

export async function archiveAction(id: string): Promise<ActionResult> {
  const { user } = await context();
  try {
    archiveReminder(user.id, id);
    refreshAll();
    return { ok: true, message: "Archived." };
  } catch (e) {
    return failure(e);
  }
}

export async function unarchiveAction(id: string): Promise<ActionResult> {
  const { user, today } = await context();
  try {
    unarchiveReminder(user.id, id, today);
    refreshAll();
    return { ok: true, message: "Restored." };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteReminderAction(id: string): Promise<ActionResult> {
  const { user } = await context();
  try {
    await deleteReminder(user.id, id);
    refreshAll();
    return { ok: true, message: "Deleted." };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteAttachmentAction(attachmentId: string): Promise<ActionResult> {
  const { user } = await context();
  try {
    await deleteAttachment(user.id, attachmentId);
    refreshAll();
    return { ok: true, message: "Attachment removed." };
  } catch (e) {
    return failure(e);
  }
}
