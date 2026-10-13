import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";

/**
 * Attachment storage. Bytes are kept in Postgres (`attachment_blobs`) so the
 * app runs on serverless hosts with no persistent disk. Swap in an
 * object-storage implementation of `FileStorage` without touching callers.
 */
export interface FileStorage {
  save(key: string, data: Buffer, userId: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export const databaseStorage: FileStorage = {
  async save(key, data, userId) {
    await getDb()
      .insert(schema.attachmentBlobs)
      .values({ storageKey: key, userId, data });
  },
  async read(key) {
    const [row] = await getDb()
      .select({ data: schema.attachmentBlobs.data })
      .from(schema.attachmentBlobs)
      .where(eq(schema.attachmentBlobs.storageKey, key));
    if (!row) throw new Error("Attachment not found");
    return Buffer.from(row.data);
  },
  async remove(key) {
    await getDb()
      .delete(schema.attachmentBlobs)
      .where(eq(schema.attachmentBlobs.storageKey, key));
  },
};

export const storage: FileStorage = databaseStorage;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/gif": "gif",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
