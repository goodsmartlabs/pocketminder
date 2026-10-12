/**
 * Small helpers for the plain-form auth endpoints.
 *
 * Redirects use a *relative* Location header so they always stay on whatever
 * domain the browser is using, no matter how the host or proxy is configured.
 */
export function seeOther(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

/** Reject cross-site form posts (CSRF). Requests without an Origin are allowed. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")]
    .flatMap((h) => (h ? h.split(",") : []))
    .map((h) => h.trim())
    .filter(Boolean);
  return hosts.includes(originHost);
}
