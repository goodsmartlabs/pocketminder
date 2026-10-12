import { isSameOrigin, seeOther } from "@/lib/http";
import { logIn } from "@/server/auth-flows";

export const dynamic = "force-dynamic";

/** Plain HTML form POST: works with or without JavaScript, behind any proxy. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").slice(0, 200);
  const back = (code: string) =>
    seeOther(`/login?error=${code}${email ? `&email=${encodeURIComponent(email)}` : ""}`);
  if (!isSameOrigin(request)) return back("origin");
  if (!form) return back("server");
  try {
    const result = await logIn(form);
    return result.ok ? seeOther("/") : back(result.code);
  } catch (e) {
    console.error("Sign-in failed", e);
    return back("server");
  }
}
