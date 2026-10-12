import { destroySession } from "@/lib/auth";
import { isSameOrigin, seeOther } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (isSameOrigin(request)) await destroySession();
  return seeOther("/login");
}
