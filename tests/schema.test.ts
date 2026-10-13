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
