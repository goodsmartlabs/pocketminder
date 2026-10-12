import { isSameOrigin, seeOther } from "@/lib/http";
import { signUp } from "@/server/auth-flows";

export const dynamic = "force-dynamic";

/** Plain HTML form POST: works with or without JavaScript, behind any proxy. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").slice(0, 200);
  const name = String(form?.get("name") ?? "").slice(0, 80);
  const back = (code: string) => {
    const q = new URLSearchParams({ error: code });
    if (email) q.set("email", email);
    if (name) q.set("name", name);
    return seeOther(`/signup?${q.toString()}`);
  };
  if (!isSameOrigin(request)) return back("origin");
  if (!form) return back("server");
  try {
    const result = await signUp(form);
    return result.ok ? seeOther("/") : back(result.code);
  } catch (e) {
    console.error("Sign-up failed", e);
    return back("server");
  }
}
