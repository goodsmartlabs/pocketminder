import { storage } from "@/lib/storage";
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import type { SpaceView } from "@/lib/types";
import { looksLikeSecret } from "@/lib/domain";

export const spaceInput = z.object({
  name: z.string().trim().min(1, "Name your Space.").max(100),
  description: z
    .string()
    .trim()
    .max(1000)
    .refine(
      (v) => !looksLikeSecret(v),
      "Keep passwords and secrets out of notes.",
    )
    .default(""),
  icon: z
    .enum([
      "folder",
      "briefcase",
      "user",
      "graduation-cap",
      "plane",
      "building",
      "heart",
    ])
    .default("folder"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#48786c"),
});
export function listSpaces(userId: string, archived = false): SpaceView[] {
  return getDb()
    .select()
    .from(schema.spaces)
    .where(
      and(
        eq(schema.spaces.userId, userId),
        eq(schema.spaces.status, archived ? "archived" : "active"),
      ),
    )
    .orderBy(asc(schema.spaces.name))
    .all()
    .map(({ id, name, description, icon, color, status }) => ({
      id,
      name,
      description,
      icon,
      color,
      status,
    }));
}
export function getSpace(userId: string, id: string): SpaceView {
  const row = getDb()
    .select()
    .from(schema.spaces)
    .where(and(eq(schema.spaces.id, id), eq(schema.spaces.userId, userId)))
    .get();
  if (!row) throw new Error("Minder Space not found.");
  const { name, description, icon, color, status } = row;
  return { id, name, description, icon, color, status };
}
export function createSpace(userId: string, raw: unknown): string {
  const input = spaceInput.parse(raw);
  const id = crypto.randomUUID();
  getDb().transaction((tx) => {
    tx.insert(schema.spaces)
      .values({ id, userId, ...input })
      .run();
    const names =
      input.icon === "briefcase" ||
      input.icon === "plane" ||
      input.icon === "building"
        ? [
            "Documents",
            "Aircraft",
            "Employees",
            "Agreements",
            "Insurance",
            "Payments",
            "Travel",
            "Operations",
            "Certificates",
          ]
        : input.icon === "graduation-cap"
          ? ["Exams", "Registrations", "Certificates", "Academic Deadlines"]
          : [
              "Passport",
              "Travel",
              "Subscriptions",
              "Appointments",
              "Finance",
              "Personal Documents",
            ];
    const defaults = names.map((name, i) => ({
      name,
      slug: name.toLowerCase().replaceAll(" ", "-"),
      color: input.color,
      icon: "tag",
      sortOrder: i,
    }));
    tx.insert(schema.categories)
      .values(
        defaults.map((c) => ({ userId, spaceId: id, ...c, isDefault: true })),
      )
      .run();
  });
  return id;
}
export function editSpace(userId: string, id: string, raw: unknown) {
  getSpace(userId, id);
  getDb()
    .update(schema.spaces)
    .set({ ...spaceInput.parse(raw), updatedAt: new Date() })
    .where(and(eq(schema.spaces.id, id), eq(schema.spaces.userId, userId)))
    .run();
}
export function archiveSpace(userId: string, id: string, archived: boolean) {
  getSpace(userId, id);
  getDb()
    .update(schema.spaces)
    .set({
      status: archived ? "archived" : "active",
      archivedAt: archived ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.spaces.id, id), eq(schema.spaces.userId, userId)))
    .run();
}
export async function deleteSpace(
  userId: string,
  id: string,
  mode: "move" | "delete",
  destination?: string,
) {
  getSpace(userId, id);
  if (mode === "move") {
    if (
      !destination ||
      destination === id ||
      getSpace(userId, destination).status !== "active"
    )
      throw new Error("Choose another active Space.");
  }
  const files =
    mode === "delete"
      ? getDb()
          .select({ key: schema.attachments.storageKey })
          .from(schema.attachments)
          .innerJoin(
            schema.reminders,
            eq(schema.reminders.id, schema.attachments.reminderId),
          )
          .where(
            and(
              eq(schema.reminders.spaceId, id),
              eq(schema.reminders.userId, userId),
            ),
          )
          .all()
      : [];
  getDb().transaction((tx) => {
    if (mode === "move") {
      // Move categories and every historical period, preserving attachments and renewal links.
      const items = tx
        .select()
        .from(schema.reminders)
        .where(
          and(
            eq(schema.reminders.spaceId, id),
            eq(schema.reminders.userId, userId),
          ),
        )
        .all();
      const cats = tx
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.spaceId, id))
        .all();
      tx.update(schema.reminders)
        .set({ categoryId: null })
        .where(eq(schema.reminders.spaceId, id))
        .run();
      const mapping = new Map<string, string>();
      for (const c of cats) {
        const match = tx
          .select()
          .from(schema.categories)
          .where(
            and(
              eq(schema.categories.spaceId, destination!),
              eq(schema.categories.slug, c.slug),
            ),
          )
          .get();
        if (match) {
          mapping.set(c.id, match.id);
          tx.delete(schema.categories)
            .where(eq(schema.categories.id, c.id))
            .run();
        } else {
          mapping.set(c.id, c.id);
          tx.update(schema.categories)
            .set({ spaceId: destination! })
            .where(eq(schema.categories.id, c.id))
            .run();
        }
      }
      for (const r of items)
        tx.update(schema.reminders)
          .set({
            spaceId: destination!,
            categoryId: r.categoryId
              ? (mapping.get(r.categoryId) ?? null)
              : null,
            updatedAt: new Date(),
          })
          .where(eq(schema.reminders.id, r.id))
          .run();
    } else {
      tx.delete(schema.reminders)
        .where(
          and(
            eq(schema.reminders.spaceId, id),
            eq(schema.reminders.userId, userId),
          ),
        )
        .run();
    }
    tx.delete(schema.categories).where(eq(schema.categories.spaceId, id)).run();
    tx.delete(schema.spaces)
      .where(and(eq(schema.spaces.id, id), eq(schema.spaces.userId, userId)))
      .run();
  });
  await Promise.all(
    files.map((f) =>
      storage
        .remove(f.key)
        .catch((e) => console.error("Attachment cleanup failed", e)),
    ),
  );
}
