"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createSpace,
  editSpace,
  archiveSpace,
  deleteSpace,
} from "@/server/spaces";
import type { ActionResult } from "@/lib/types";
export async function saveSpaceAction(
  raw: unknown,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  try {
    const result = id
      ? (editSpace(user.id, id, raw), id)
      : createSpace(user.id, raw);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: result } };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error:
        "Unable to save. Check the Space name, description, icon and color.",
    };
  }
}
export async function manageSpaceAction(
  id: string,
  action: "archive" | "restore" | "move" | "delete",
  destination?: string,
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    if (action === "archive" || action === "restore")
      archiveSpace(user.id, id, action === "archive");
    else if (action === "move" || action === "delete")
      await deleteSpace(user.id, id, action, destination);
    else throw new Error("Invalid action");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error:
        "Unable to update this Space. Choose a valid destination before moving reminders.",
    };
  }
}
