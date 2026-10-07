"use client";

import { FileText, ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteAttachmentAction } from "@/app/actions/reminders";
import type { AttachmentView } from "@/lib/types";
import { Spinner } from "../ui/primitives";
import { useToast } from "../ui/Toast";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Attachments({
  reminderId,
  attachments,
}: {
  reminderId: string;
  attachments: AttachmentView[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, startRemove] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const upload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.show("Files can be up to 10 MB.", "error");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/reminders/${reminderId}/attachments`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      toast.show("Attached.");
      router.refresh();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Upload failed.", "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      {attachments.length > 0 && (
        <ul className="mb-3 divide-y divide-line rounded-xl border border-line">
          {attachments.map((a) => {
            const Icon = a.mimeType.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon className="size-4 shrink-0 text-ink-3" />
                <a
                  href={`/api/attachments/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink hover:underline"
                >
                  {a.fileName}
                </a>
                <span className="shrink-0 text-[12px] text-ink-3 tabular">
                  {formatSize(a.sizeBytes)}
                </span>
                <button
                  type="button"
                  disabled={removing}
                  onClick={() =>
                    startRemove(async () => {
                      const r = await deleteAttachmentAction(a.id);
                      if (r.ok) router.refresh();
                      else toast.show(r.error, "error");
                    })
                  }
                  className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-critical"
                  aria-label={`Remove ${a.fileName}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
        id={`attach-${reminderId}`}
      />
      <label
        htmlFor={`attach-${reminderId}`}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-4 text-[14px] font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent"
      >
        {uploading ? <Spinner className="size-4" /> : attachments.length ? <Upload className="size-4" /> : <Paperclip className="size-4" />}
        {uploading ? "Uploading…" : "Attach a document or photo"}
      </label>
      <p className="mt-2 text-[12px] text-ink-3">PDF, images, Word, Excel or text · up to 10 MB</p>
    </div>
  );
}
