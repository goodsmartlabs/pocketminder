import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { getAttachment } from "@/server/reminders";

const INLINE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const attachment = getAttachment(user.id, id);
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const data = await storage.read(attachment.storageKey);
    const download = new URL(request.url).searchParams.has("download");
    const disposition =
      !download && INLINE_TYPES.has(attachment.mimeType) ? "inline" : "attachment";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "Cache-Control": "private, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return NextResponse.json({ error: "File is missing." }, { status: 410 });
  }
}
