import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from "@/lib/storage";
import { addAttachment, NotFoundError } from "@/server/reminders";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to attach." }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Files can be up to 10 MB." }, { status: 413 });
  }
  if (!ALLOWED_ATTACHMENT_TYPES[file.type]) {
    return NextResponse.json(
      { error: "Attach a PDF, image, Word, Excel or text file." },
      { status: 415 },
    );
  }
  try {
    const attachmentId = await addAttachment(user.id, id, {
      name: file.name || "attachment",
      type: file.type,
      data: Buffer.from(await file.arrayBuffer()),
    });
    revalidatePath(`/reminders/${id}`);
    return NextResponse.json({ id: attachmentId });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error(e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
