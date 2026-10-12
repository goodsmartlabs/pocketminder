import "server-only";
import { eq } from "drizzle-orm";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import type { AuthErrorCode } from "@/lib/auth-messages";
import { getDb, schema } from "@/lib/db";
import { loginSchema, signupSchema } from "@/lib/validation";
import { ensureUserSetup } from "./reminders";

type Result = { ok: true } | { ok: false; code: AuthErrorCode };

function validTimezone(tz: string | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export async function signUp(form: FormData): Promise<Result> {
  const parsed = signupSchema.safeParse({
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    timezone: String(form.get("timezone") ?? ""),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      ok: false,
      code: field === "name" ? "name" : field === "password" ? "password_short" : "email",
    };
  }
  const db = getDb();
  const existing = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email))
    .get();
  if (existing) return { ok: false, code: "exists" };

  const passwordHash = await hashPassword(parsed.data.password);
  const user = db.transaction((tx) => {
    const u = tx
      .insert(schema.users)
      .values({
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        timezone: validTimezone(parsed.data.timezone),
      })
      .returning({ id: schema.users.id })
      .get();
    ensureUserSetup(u.id, tx);
    return u;
  });
  await createSession(user.id);
  return { ok: true };
}

export async function logIn(form: FormData): Promise<Result> {
  const parsed = loginSchema.safeParse({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { ok: false, code: field === "password" ? "password_missing" : "email" };
  }
  const user = getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email))
    .get();
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) return { ok: false, code: "invalid" };
  await createSession(user.id);
  return { ok: true };
}
