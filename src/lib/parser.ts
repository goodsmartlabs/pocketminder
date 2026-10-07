import * as chrono from "chrono-node";
import { isoFromParts, MONTHS, type ISODate } from "./dates";
import {
  DEFAULT_OFFSETS_BY_TYPE,
  normalizeOffsets,
  type DefaultCategorySlug,
  type Priority,
  type Recurrence,
  type ReminderType,
} from "./domain";

/**
 * Natural-language quick capture.
 *
 * Turns "Remind me 60 days before Grace's passport expires on May 18, 2028"
 * into a structured suggestion the user confirms before saving. Runs on both
 * client (instant preview while typing) and server.
 */

export interface ParsedReminder {
  title: string;
  date: ISODate | null;
  dateText: string | null;
  categorySlug: DefaultCategorySlug;
  type: ReminderType;
  offsets: number[];
  recurrence: Recurrence | null;
  associatedWith: string | null;
  priority: Priority;
}

export interface ParseOptions {
  /** Today in the user's time zone. */
  today: ISODate;
  /** Interpret 03/04 as 3 April (true) or March 4 (false). */
  dayFirst?: boolean;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fourteen: 14,
  thirty: 30,
  sixty: 60,
  ninety: 90,
};

const NUM = `(\\d+|${Object.keys(NUMBER_WORDS).join("|")})`;
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

function toNumber(word: string): number {
  const n = Number(word);
  return Number.isFinite(n) ? n : (NUMBER_WORDS[word.toLowerCase()] ?? 1);
}

/* ------------------------------------------------------------------ */
/* Keyword tables                                                      */
/* ------------------------------------------------------------------ */

const CATEGORY_KEYWORDS: [DefaultCategorySlug, RegExp][] = [
  [
    "documents",
    /\b(passports?|visas?|permits?|work permit|licen[cs]es?|certificates?|certification|id card|identity card|national id|driving|registration|residency|residence card|iqama|emirates id|green card|medical certificate)\b/i,
  ],
  [
    "agreements",
    /\b(agreements?|contracts?|leases?|insurance|polic(y|ies)|warrant(y|ies)|nda|tenancy|retainer|sla)\b/i,
  ],
  ["people", /\b(birthdays?|anniversar(y|ies)|wedding|graduation|baby shower)\b/i],
  [
    "travel",
    /\b(flights?|tickets?|travel|trip|hotel|holiday|vacation|train|boarding|itinerary|check[- ]?in)\b/i,
  ],
  [
    "payments",
    /\b(pay|payments?|invoices?|bills?|rent|subscriptions?|fees?|tax(es)?|instal+ments?|loan|mortgage|dues|premium)\b/i,
  ],
  [
    "work",
    /\b(meetings?|inspections?|audits?|filings?|regulatory|compliance|reports?|reviews?|engineers?|employees?|staff|office|clients?|board|passwords?|appraisal|payroll|vat|return)\b/i,
  ],
  [
    "personal",
    /\b(dentist|doctor|gp|appointment|gym|vet|haircut|checkup|check-up|school|exam|mot|service)\b/i,
  ],
];

const TYPE_KEYWORDS: [ReminderType, RegExp][] = [
  ["expiry", /\b(expire[sd]?|expiring|expiry|expiration|lapses?|valid until|runs out)\b/i],
  ["renewal", /\b(renew|renews|renewal|renewing)\b/i],
  ["booking", /\b(book|booking|reserve|reservation)\b/i],
  ["payment", /\b(pay|payment|invoice|bill|rent|instal+ment|premium)\b/i],
  [
    "appointment",
    /\b(appointment|dentist|doctor|clinic|interview|haircut|checkup|check-up|consultation)\b/i,
  ],
  ["follow_up", /\b(follow[ -]?up|chase|check in with|get back to)\b/i],
  [
    "event",
    /\b(birthday|anniversary|meeting|wedding|party|flight|trip|conference|travel|concert|ceremony)\b/i,
  ],
  [
    "deadline",
    /\b(deadline|due|submit|file|filing|apply|application|inspection|audit|change|rotate|update|register)\b/i,
  ],
];

const ASSET_RE =
  /\b(aircraft|plane|car|vehicle|truck|van|boat|yacht|office|house|home|apartment|flat|warehouse|equipment|generator|laptop|server|domain|website)\b/i;

/* ------------------------------------------------------------------ */
/* Extraction helpers                                                  */
/* ------------------------------------------------------------------ */

function extractOffsets(text: string): { text: string; offsets: number[] } {
  const offsets: number[] = [];
  let out = text.replace(
    new RegExp(
      `\\b${NUM}\\s+(day|week|month|year)s?\\s+(before|prior(?:\\s+to)?|ahead(?:\\s+of(?:\\s+time)?)?|in advance|early|earlier)\\b`,
      "gi",
    ),
    (_m, n: string, unit: string) => {
      offsets.push(toNumber(n) * UNIT_DAYS[unit.toLowerCase()]);
      return " ";
    },
  );
  out = out.replace(/\b(the day before)\b/gi, () => {
    offsets.push(1);
    return " ";
  });
  out = out.replace(/\b(a|one) week (before|prior)\b/gi, () => {
    offsets.push(7);
    return " ";
  });
  out = out.replace(/\b(and )?on the day\b/gi, () => {
    offsets.push(0);
    return " ";
  });
  return { text: out, offsets };
}

function extractRecurrence(text: string): { text: string; recurrence: Recurrence | null } {
  let recurrence: Recurrence | null = null;
  let out = text;

  const everyN = new RegExp(`\\b(every|each)\\s+${NUM}\\s+(day|week|month|year)s?\\b`, "i");
  const everyUnit = /\b(every|each)\s+(day|week|month|quarter|year)\b/i;
  const m1 = out.match(everyN);
  const m2 = out.match(everyUnit);
  if (m1) {
    recurrence = {
      unit: m1[3].toLowerCase() as Recurrence["unit"],
      interval: Math.max(1, toNumber(m1[2])),
    };
    out = out.replace(m1[0], " ");
  } else if (m2) {
    const u = m2[2].toLowerCase();
    recurrence =
      u === "quarter"
        ? { unit: "month", interval: 3 }
        : { unit: u as Recurrence["unit"], interval: 1 };
    out = out.replace(m2[0], " ");
  } else {
    const adverbs: [RegExp, Recurrence][] = [
      [/\b(annually|yearly|once a year)\b/i, { unit: "year", interval: 1 }],
      [/\b(semi-?annually|bi-?annually|twice a year)\b/i, { unit: "month", interval: 6 }],
      [/\b(quarterly)\b/i, { unit: "month", interval: 3 }],
      [/\b(monthly|once a month)\b/i, { unit: "month", interval: 1 }],
      [/\b(weekly|once a week)\b/i, { unit: "week", interval: 1 }],
      [/\b(daily)\b/i, { unit: "day", interval: 1 }],
    ];
    for (const [re, rec] of adverbs) {
      const m = out.match(re);
      if (!m) continue;
      recurrence = rec;
      // "Quarterly filing" keeps its adjective; "pay rent monthly" drops the adverb.
      const isLeadingAdjective = out.trim().toLowerCase().startsWith(m[0].toLowerCase());
      if (!isLeadingAdjective) out = out.replace(m[0], " ");
      break;
    }
  }
  return { text: out, recurrence };
}

function referenceDate(today: ISODate): Date {
  const [y, m, d] = today.split("-").map(Number);
  // Midday local time keeps chrono's relative maths ("tomorrow") on the right day.
  return new Date(y, m - 1, d, 12, 0, 0);
}

interface DateMatch {
  date: ISODate;
  text: string;
  index: number;
}

const NUMERIC_DATE_RE = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/;

function extractDate(text: string, opts: ParseOptions): DateMatch | null {
  const dayFirst = opts.dayFirst !== false;
  const ref = referenceDate(opts.today);
  const results = chrono.en.casual.parse(text, ref, { forwardDate: true });
  // Ignore vague month-only mentions ("the engineer's September ticket").
  const usable = results.filter((r) => r.start.isCertain("day") || r.start.isCertain("weekday"));
  if (usable.length > 0) {
    // Prefer a date introduced by on/by/before/until; otherwise the last one mentioned.
    const preferred =
      usable.find((r) =>
        /\b(on|by|before|until|due|expires?|expiring|from|starting)\s*$/i.test(
          text.slice(0, r.index),
        ),
      ) ?? usable[usable.length - 1];
    const s = preferred.start;
    let year = s.get("year");
    let month = s.get("month");
    let day = s.get("day");
    // chrono reads 03/04 as March 4; most of the world means 3 April.
    const numeric = preferred.text.trim().match(NUMERIC_DATE_RE);
    if (numeric && dayFirst) {
      const d = Number(numeric[1]);
      const m = Number(numeric[2]);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        day = d;
        month = m;
        if (numeric[3]) {
          year = Number(numeric[3]) < 100 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
        } else {
          const [ty, tm, td] = opts.today.split("-").map(Number);
          year = m < tm || (m === tm && d < td) ? ty + 1 : ty;
        }
      }
    }
    if (year && month && day) {
      return { date: isoFromParts(year, month, day), text: preferred.text, index: preferred.index };
    }
  }

  // "on the 20th" — the next time that day of the month comes round.
  const ordinal = text.match(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (ordinal && ordinal.index !== undefined) {
    const d = Number(ordinal[1]);
    if (d >= 1 && d <= 31) {
      const [ty, tm, td] = opts.today.split("-").map(Number);
      let y = ty;
      let m = d >= td ? tm : tm + 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return {
        date: isoFromParts(y, m, Math.min(d, lastDay)),
        text: ordinal[0],
        index: ordinal.index,
      };
    }
  }
  return null;
}

function detectCategory(text: string, recurrence: Recurrence | null): DefaultCategorySlug {
  for (const [slug, re] of CATEGORY_KEYWORDS) if (re.test(text)) return slug;
  return recurrence ? "recurring" : "personal";
}

function detectType(text: string, hadBy: boolean): ReminderType {
  for (const [type, re] of TYPE_KEYWORDS) if (re.test(text)) return type;
  return hadBy ? "deadline" : "custom";
}

const NOT_PEOPLE = new Set([
  ...MONTHS,
  "Today",
  "Tomorrow",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Company",
  "Our",
  "My",
  "Office",
  "Team",
  "Remind",
]);

function detectAssociated(text: string): string | null {
  const possessive = text.match(/\b([A-Z][a-zA-Z-]+(?:\s[A-Z][a-zA-Z-]+)?)['’]s\b/);
  if (possessive && !NOT_PEOPLE.has(possessive[1].split(" ")[0])) return possessive[1];
  const forName = text.match(/\b(?:for|with)\s+([A-Z][a-zA-Z-]+(?:\s[A-Z][a-zA-Z-]+)?)\b/);
  if (forName && !NOT_PEOPLE.has(forName[1].split(" ")[0])) return forName[1];
  const asset = text.match(ASSET_RE);
  if (asset) return asset[1][0].toUpperCase() + asset[1].slice(1).toLowerCase();
  return null;
}

function detectPriority(text: string, category: DefaultCategorySlug, type: ReminderType): Priority {
  if (/\b(critical|urgent|asap)\b/i.test(text)) return "critical";
  if (/\b(important|must not forget|don't forget|do not forget)\b/i.test(text)) return "high";
  if (
    (type === "expiry" || type === "renewal") &&
    /\b(passport|visa|permit|licen[cs]e|certificate|insurance|residency)\b/i.test(text)
  )
    return "high";
  if (category === "documents" && type === "expiry") return "high";
  return "normal";
}

const LEADING_FILLER =
  /^(please\s+)?(remind me (to|about|that|of)?|reminder( to| for| that)?:?|don't forget (to|about|that)?|do not forget (to|about|that)?|remember (to|that)?|i need to|we need to|need to|make sure (to|that)?|note:?)\s*/i;

const TRAILING_VERBS =
  /\s+(expires|expire|expiring|expiry|will expire|is expiring|is due|are due|due|renews|ends|is|are|will|needs renewing|needs to be renewed|runs out|lapses|starts|begins|is on|happens)$/i;

const DANGLING_PREPOSITION =
  /\s+(on|by|before|until|at|for|from|starting|due|in|of|the|is|and|to)$/i;

function cleanTitle(raw: string): string {
  let t = raw
    .replace(/[“”]/g, '"')
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  t = t.replace(/^[,.;:\-–—\s]+|[,.;:\-–—!?\s]+$/g, "");
  t = t.replace(LEADING_FILLER, "");
  for (let i = 0; i < 4; i++) {
    const before = t;
    t = t.replace(/[,.;:\-–—!?\s]+$/g, "");
    t = t.replace(DANGLING_PREPOSITION, "");
    t = t.replace(TRAILING_VERBS, "");
    if (t === before) break;
  }
  t = t.replace(/\b(our|my)\s+/gi, "");
  t = t.replace(/\s{2,}/g, " ").trim();
  if (!t) return "";
  return t[0].toUpperCase() + t.slice(1);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function parseReminder(input: string, opts: ParseOptions): ParsedReminder {
  const original = input.trim().replace(/\s+/g, " ");

  const { text: afterOffsets, offsets: explicitOffsets } = extractOffsets(original);
  const { text: afterRecurrence, recurrence: explicitRecurrence } =
    extractRecurrence(afterOffsets);

  const dateMatch = extractDate(afterRecurrence, opts);
  let remainder = afterRecurrence;
  let hadBy = false;
  if (dateMatch) {
    const prefix = afterRecurrence.slice(0, dateMatch.index);
    hadBy = /\bby\s*$/i.test(prefix) || /^by\b/i.test(dateMatch.text);
    remainder = prefix + " " + afterRecurrence.slice(dateMatch.index + dateMatch.text.length);
  }

  const category = detectCategory(original, explicitRecurrence);
  const type = detectType(original, hadBy);
  let recurrence = explicitRecurrence;
  if (!recurrence && /\b(birthday|anniversary)\b/i.test(original)) {
    recurrence = { unit: "year", interval: 1 };
  }

  // Explicit "60 days before" sets where reminding starts; we keep the
  // standard escalation steps that fall after it.
  const typeDefaults = DEFAULT_OFFSETS_BY_TYPE[type];
  let offsets: number[];
  if (explicitOffsets.length > 0) {
    const earliest = Math.max(...explicitOffsets);
    offsets = normalizeOffsets([
      ...explicitOffsets,
      ...typeDefaults.filter((o) => o < earliest),
    ]);
  } else {
    offsets = normalizeOffsets(typeDefaults);
  }

  // Reminding 90 days ahead of something that repeats monthly is just noise.
  if (recurrence) {
    const cycleDays = recurrence.interval * UNIT_DAYS[recurrence.unit];
    const fitting = offsets.filter((o) => o < cycleDays);
    offsets = fitting.length > 0 ? fitting : [0];
  }

  const title = cleanTitle(remainder) || cleanTitle(original) || "Untitled reminder";

  return {
    title: title.slice(0, 140),
    date: dateMatch?.date ?? null,
    dateText: dateMatch?.text ?? null,
    categorySlug: category,
    type,
    offsets,
    recurrence,
    associatedWith: detectAssociated(original),
    priority: detectPriority(original, category, type),
  };
}

export const QUICK_CAPTURE_EXAMPLES = [
  "John's visa expires on 14 November 2026",
  "Remind me to book the engineer's September ticket by August 10",
  "Aircraft insurance expires December 3",
  "Renew our office agreement on January 31",
  "Remind me 60 days before Grace's passport expires on May 18, 2028",
];
