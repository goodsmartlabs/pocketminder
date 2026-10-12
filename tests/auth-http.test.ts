import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth-messages";
import { isSameOrigin, seeOther } from "@/lib/http";

const req = (headers: Record<string, string>) =>
  new Request("http://internal/api/auth/login", { method: "POST", headers });

describe("auth form endpoints", () => {
  it("redirects with a relative 303 so any domain works", () => {
    const r = seeOther("/");
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/");
  });

  it("accepts same-origin posts behind a proxy", () => {
    expect(isSameOrigin(req({ origin: "https://app.example.com", host: "app.example.com" }))).toBe(true);
    expect(
      isSameOrigin(
        req({ origin: "https://app.example.com", host: "10.0.0.5:3000", "x-forwarded-host": "app.example.com" }),
      ),
    ).toBe(true);
    expect(isSameOrigin(req({ host: "app.example.com" }))).toBe(true);
  });

  it("rejects cross-site posts", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example", host: "app.example.com" }))).toBe(false);
  });

  it("only renders known error codes", () => {
    expect(authErrorMessage("invalid")).toMatch(/don't match/);
    expect(authErrorMessage("<script>")).toBeNull();
    expect(authErrorMessage(undefined)).toBeNull();
  });
});
