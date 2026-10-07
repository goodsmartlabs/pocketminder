"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { CATEGORY_COLORS, MAX_OFFSET_DAYS, normalizeOffsets } from "@/lib/domain";
import type { ActionResult } from "@/lib/types";
import { fieldErrors } from "@/lib/validation";
import { markRead } from "@/server/notifications";

function refreshAll() {
  revalidatePath("/", "layout");
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(80),
  timezone: z
    .string()
    .trim()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown time zone."),
});

export async function updateProfileAction(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errors)[0], fieldErrors: errors };
  }
  getDb()
    .update(schema.users)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))
    .run();
  refreshAll();
  return { ok: true, message: "Profile saved." };
}

const preferencesSchema = z.object({
  notificationLevel: z.enum(["all", "key", "minimal"]),
  inAppEnabled: z.boolean(),
  browserEnabled: z.boolean(),
  dayFirst: z.boolean(),
  defaultOffsets: z.array(z.number().int().min(0).max(MAX_OFFSET_DAYS)).max(20),
});

export async function updatePreferencesAction(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = preferencesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Those settings don't look right." };
  const { defaultOffsets, ...rest } = parsed.data;
  getDb()
    .update(schema.userSettings)
    .set({
      ...rest,
      defaultOffsets: JSON.stringify(normalizeOffsets(defaultOffsets)),
      updatedAt: new Date(),
    })
    .where(eq(schema.userSettings.userId, user.id))
    .run();
  refreshAll();
  return { ok: true, message: "Preferences saved." };
}

const passwordSchema = z.object({
  current: z.string().min(1, "Enter your current password."),
  next: z.string().min(8, "Use at least 8 characters.").max(200),
});

export async function changePasswordAction(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errors)[0], fieldErrors: errors };
  }
  const db = getDb();
  const row = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
  if (!row || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
    return {
      ok: false,
      error: "Current password is incorrect.",
      fieldErrors: { current: "Incorrect password." },
    };
  }
  db.update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.next), updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))
    .run();
  return { ok: true, message: "Password updated." };
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name your category.").max(40, "Keep it short."),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "category"
  );
}

export async function addCategoryAction(name: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error).name };
  const db = getDb();
  const existing = db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.userId, user.id))
    .all();
  const slug = slugify(parsed.data.name);
  if (existing.some((c) => c.slug === slug || c.name.toLowerCase() === parsed.data.name.toLowerCase()))
    return { ok: false, error: "You already have a category with that name." };
  if (existing.length >= 50) return { ok: false, error: "That's the maximum number of categories." };
  db.insert(schema.categories)
    .values({
      userId: user.id,
      name: parsed.data.name,
      slug,
      color: CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length],
      icon: "tag",
      isDefault: false,
      sortOrder: 100 + existing.length,
    })
    .run();
  refreshAll();
  return { ok: true, message: "Category added." };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const db = getDb();
  const cat = db
    .select()
    .from(schema.categories)
    .where(and(eq(schema.categories.id, id), eq(schema.categories.userId, user.id)))
    .get();
  if (!cat) return { ok: false, error: "Category not found." };
  if (cat.isDefault) return { ok: false, error: "Default categories can't be removed." };
  const custom = db
    .select()
    .from(schema.categories)
    .where(and(eq(schema.categories.userId, user.id), eq(schema.categories.slug, "custom")))
    .get();
  db.transaction((tx) => {
    // Reminders in this category move to "Custom" rather than losing a category.
    tx.update(schema.reminders)
      .set({ categoryId: custom?.id ?? null })
      .where(and(eq(schema.reminders.userId, user.id), eq(schema.reminders.categoryId, id)))
      .run();
    tx.delete(schema.categories).where(eq(schema.categories.id, id)).run();
  });
  refreshAll();
  return { ok: true, message: "Category removed." };
}

export async function markNotificationsReadAction(ids: string[] | "all"): Promise<ActionResult> {
  const user = await requireUser();
  markRead(user.id, ids === "all" ? "all" : ids.filter((i) => typeof i === "string"));
  refreshAll();
  return { ok: true };
}
