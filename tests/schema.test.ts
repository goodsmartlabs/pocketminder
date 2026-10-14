import { describe, expect, it } from "vitest";
import { freshDb } from "./pg";

describe("Postgres schema", () => {
  it("applies cleanly and rejects reminders without an owned Space", async () => {
    const { client } = await freshDb();
    await client.exec(
      "INSERT INTO users(id,email,name,password_hash) VALUES ('u','u@example.com','U','x');" +
        "INSERT INTO spaces(id,user_id,name) VALUES ('s','u','Work');" +
        "INSERT INTO reminders(id,user_id,space_id,series_id,title,important_date) VALUES ('r','u','s','r','Passport','2027-01-01');",
    );
    const { rows } = await client.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM reminders",
    );
    expect(rows[0].n).toBe(1);
    await expect(
      client.exec(
        "INSERT INTO reminders(id,user_id,series_id,title,important_date) VALUES ('bad','u','bad','bad','2027-01-01')",
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        "INSERT INTO reminders(id,user_id,space_id,series_id,title,important_date) VALUES ('bad','u','missing','bad','bad','2027-01-01')",
      ),
    ).rejects.toThrow();
    await client.close();
  });
});

describe("database URL", () => {
  it("prefers DATABASE_URL and accepts the Supabase integration's POSTGRES_URL", async () => {
    const { databaseUrl } = await import("@/lib/db");
    expect(databaseUrl({ DATABASE_URL: "postgres://a@h:5432/d", POSTGRES_URL: "postgres://b@h/d" })).toBe(
      "postgres://a@h:5432/d",
    );
    expect(
      databaseUrl({ POSTGRES_URL: "postgres://u:p@pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x" }),
    ).toBe("postgres://u:p@pooler.supabase.com:6543/postgres?sslmode=require");
    expect(() => databaseUrl({})).toThrow();
  });
});
