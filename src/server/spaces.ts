import "server-only";
import { firstRow } from "@/lib/db/first";
import { storage } from "@/lib/storage";
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
export async function listSpaces(
  userId: string,
  archived = false,
): Promise<SpaceView[]> {
  const rows = await getDb()
    .select()
    .from(schema.spaces)
    .where(
      and(
        eq(schema.spaces.userId, userId),
        eq(schema.spaces.status, archived ? "archived" : "active"),
      ),
    )
    .orderBy(asc(schema.spaces.name));
  return rows.map(({ id, name, description, icon, color, status }) => ({
    id,
    name,
    description,
    icon,
    color,
    status,
  }));
}

export async function getSpace(userId: string, id: string): Promise<SpaceView> {
  const row = await getDb()
    .select()
    .from(schema.spaces)
    .where(and(eq(schema.spaces.id, id), eq(schema.spaces.userId, userId)))
    .then(firstRow);
  if (!row) throw new Error("Minder Space not found.");
  const { name, description, icon, color, status } = row;
  return { id, name, description, icon, color, status };
}

function defaultCategoryNames(icon: string): string[] {
  if (icon === "briefcase" || icon === "plane" || icon === "building")
    return [
      "Documents",
      "Aircraft",
      "Employees",
      "Agreements",
      "Insurance",
      "Payments",
      "Travel",
      "Operations",
      "Certificates",
    ];
  if (icon === "graduation-cap")
    return ["Exams", "Registrations", "Certificates", "Academic Deadlines"];
  return [
    "Passport",
    "Travel",
    "Subscriptions",
    "Appointments",
    "Finance",
    "Personal Documents",
  ];
}

export async function createSpace(
  userId: string,
  raw: unknown,
): Promise<string> {
  const input = spaceInput.parse(raw);
  const id = crypto.randomUUID();
  await getDb().transaction(async (tx) => {
    await tx.insert(schema.spaces).values({ id, userId, ...input });
    const defaults = defaultCategoryNames(input.icon).map((name, i) => ({
      userId,
      spaceId: id,
      name,
      slug: name.toLowerCase().replaceAll(" ", "-"),
      color: input.color,
      icon: "tag",
      sortOrder: i,
      isDefault: true,
    }));
    await tx.insert(schema.categories).values(defaults);
  });
  return id;
}

export async function editSpace(
  userId: string,
  id: string,
  raw: unknown,
): Promise<void> {
  await getSpace(userId, id);
  await getDb()
    .update(schema.spaces)
    .set({ ...spaceInput.parse(raw), updatedAt: new Date() })
    .where(and(eq(schema.spaces.id, id), eq(schema.spaces.userId, userId)));
}

export async function archiveSpace(
  userId: string,
  id: string,
  archived: boolean,
): Promise<void> {
  await getSpace(userId, id);
  await getDb()
    .update(schema.spaces)
    .set({
      status: archived ? "archived" : "active",
      archivedAt: archived ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.spaces.id, id), eq(schema.spaces.userId, userId)));
}

export async function deleteSpace(
  userId: string,
  id: string,
  mode: "move" | "delete",
  destination?: string,
): Promise<void> {
  await getSpace(userId, id);
  if (mode === "move") {
    if (
      !destination ||
      destination === id ||
      (await getSpace(userId, destination)).status !== "active"
    )
      throw new Error("Choose another active Space.");
  }
  const db = getDb();
  const files =
    mode === "delete"
      ? await db
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
      : [];
  await db.transaction(async (tx) => {
    if (mode === "move") {
      // Move categories and every historical period, preserving attachments and renewal links.
      const items = await tx
        .select()
        .from(schema.reminders)
        .where(
          and(
            eq(schema.reminders.spaceId, id),
            eq(schema.reminders.userId, userId),
          ),
        );
      const cats = await tx
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.spaceId, id));
      await tx
        .update(schema.reminders)
        .set({ categoryId: null })
        .where(eq(schema.reminders.spaceId, id));
      const mapping = new Map<string, string>();
      for (const c of cats) {
        const match = await tx
          .select()
          .from(schema.categories)
          .where(
            and(
              eq(schema.categories.spaceId, destination!),
              eq(schema.categories.slug, c.slug),
            ),
          )
          .then(firstRow);
        if (match) {
          mapping.set(c.id, match.id);
          await tx
            .delete(schema.categories)
            .where(eq(schema.categories.id, c.id));
        } else {
          mapping.set(c.id, c.id);
          await tx
            .update(schema.categories)
            .set({ spaceId: destination! })
            .where(eq(schema.categories.id, c.id));
        }
      }
      for (const r of items)
        await tx
          .update(schema.reminders)
          .set({
            spaceId: destination!,
            categoryId: r.categoryId
              ? (mapping.get(r.categoryId) ?? null)
              : null,
            updatedAt: new Date(),
          })
          .where(eq(schema.reminders.id, r.id));
    } else {
      await tx
        .delete(schema.reminders)
        .where(
          and(
            eq(schema.reminders.spaceId, id),
            eq(schema.reminders.userId, userId),
          ),
        );
    }
    await tx.delete(schema.categories).where(eq(schema.categories.spaceId, id));
    await tx
      .delete(schema.spaces)
      .where(and(eq(schema.spaces.id, id), eq(schema.spaces.userId, userId)));
  });
  await Promise.all(
    files.map((f) =>
      storage
        .remove(f.key)
        .catch((e) => console.error("Attachment cleanup failed", e)),
    ),
  );
}
