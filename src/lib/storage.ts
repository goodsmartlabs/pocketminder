import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./db";

/**
 * Attachment storage. Files live on local disk today; swap in an S3-style
 * implementation of `FileStorage` without touching callers.
 */
export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

const UPLOAD_ROOT = path.join(/*turbopackIgnore: true*/ DATA_DIR, "uploads");

function resolveKey(key: string): string {
  const full = path.resolve(/*turbopackIgnore: true*/ UPLOAD_ROOT, key);
  if (!full.startsWith(UPLOAD_ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export const localStorage: FileStorage = {
  async save(key, data) {
    const full = resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  },
  async read(key) {
    return fs.readFile(resolveKey(key));
  },
  async remove(key) {
    await fs.rm(resolveKey(key), { force: true });
  },
};

export const storage: FileStorage = localStorage;

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
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
