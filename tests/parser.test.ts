import { describe, expect, it } from "vitest";
import { parseReminder } from "@/lib/parser";

const today = "2026-10-07";
const parse = (t: string, dayFirst = true) => parseReminder(t, { today, dayFirst });

describe("quick capture parser", () => {
  it("parses an expiry with a person", () => {
    const p = parse("John's visa expires on 14 November 2026.");
    expect(p).toMatchObject({
      title: "John's visa",
      date: "2026-11-14",
      categorySlug: "documents",
      type: "expiry",
      associatedWith: "John",
      priority: "high",
    });
    expect(p.offsets).toEqual([90, 60, 30, 14, 7, 1, 0]);
  });

  it("ignores a month-only mention and uses the deadline date", () => {
    const p = parse("Remind me to book the engineer's September ticket by August 10.");
    expect(p).toMatchObject({
      title: "Book the engineer's September ticket",
      date: "2027-08-10",
      categorySlug: "travel",
      type: "booking",
    });
  });

  it("rolls dates without a year forward", () => {
    expect(parse("Aircraft insurance expires December 3.").date).toBe("2026-12-03");
    expect(parse("Renew our office agreement on January 31.")).toMatchObject({
      title: "Renew office agreement",
      date: "2027-01-31",
      type: "renewal",
      categorySlug: "agreements",
    });
  });

  it("honours an explicit advance reminder and keeps later escalation steps", () => {
    const p = parse("Remind me 60 days before Grace's passport expires on May 18, 2028.");
    expect(p.title).toBe("Grace's passport");
    expect(p.date).toBe("2028-05-18");
    expect(p.offsets).toEqual([60, 30, 14, 7, 1, 0]);
  });

  it("reads numeric dates day-first or month-first", () => {
    expect(parse("Mum's birthday 3/4").date).toBe("2027-04-03");
    expect(parse("Mum's birthday 3/4", false).date).toBe("2027-03-04");
  });

  it("detects recurrence and trims timing to the cycle", () => {
    const p = parse("Netflix subscription renews monthly on the 20th");
    expect(p.recurrence).toEqual({ unit: "month", interval: 1 });
    expect(p.date).toBe("2026-10-20");
    expect(Math.max(...p.offsets)).toBeLessThan(30);
    expect(parse("Quarterly filing every 3 months starting Jan 15")).toMatchObject({
      title: "Quarterly filing",
      recurrence: { unit: "month", interval: 3 },
      date: "2027-01-15",
    });
    expect(parse("Mum's birthday 3/4").recurrence).toEqual({ unit: "year", interval: 1 });
  });

  it("returns no date when there is none", () => {
    const p = parse("Passport expiry");
    expect(p.date).toBeNull();
    expect(p.title).toBe("Passport");
  });
});
