"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fieldErrors, loginSchema, signupSchema } from "@/lib/validation";
import { ensureUserSetup } from "@/server/reminders";

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: { name?: string; email?: string };
}

function validTimezone(tz: string | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
  };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error),
      values: { name: raw.name, email: raw.email },
    };
  }
  const db = getDb();
  const existing = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email))
    .get();
  if (existing) {
    return {
      fieldErrors: { email: "An account with this email already exists. Try signing in." },
      values: { name: raw.name, email: raw.email },
    };
  }
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
  redirect("/");
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values: { email: raw.email } };
  }
  const user = getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email))
    .get();
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) {
    return { error: "That email and password don't match.", values: { email: raw.email } };
  }
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
