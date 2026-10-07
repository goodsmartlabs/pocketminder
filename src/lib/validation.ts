import { z } from "zod";
import { isISODate } from "./dates";
import {
  looksLikeSecret,
  MAX_OFFSET_DAYS,
  PRIORITY_VALUES,
  RECURRENCE_UNITS,
  REMINDER_TYPE_VALUES,
  SECRET_WARNING,
} from "./domain";

const isoDate = z
  .string()
  .trim()
  .refine(isISODate, "Please choose a valid date.")
  .refine((d) => {
    const y = Number(d.slice(0, 4));
    return y >= 1900 && y <= 2200;
  }, "Please choose a date between 1900 and 2200.");

const noSecrets = (field: z.ZodString) =>
  field.refine((v) => !looksLikeSecret(v), SECRET_WARNING);

const optionalText = (max: number) =>
  noSecrets(z.string().trim().max(max, `Keep this under ${max} characters.`))
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const recurrenceSchema = z
  .object({
    unit: z.enum(RECURRENCE_UNITS),
    interval: z.coerce.number().int().min(1, "Interval must be at least 1.").max(120),
  })
  .nullable();

export const reminderInputSchema = z.object({
  spaceId: z.string().trim().min(1, "Where should I remember this?"),
  title: noSecrets(
    z.string().trim().min(1, "What do you need to remember?").max(140, "Keep the title short."),
  ),
  importantDate: isoDate,
  categoryId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  reminderType: z.enum(REMINDER_TYPE_VALUES),
  associatedWith: optionalText(120),
  description: optionalText(5000),
  priority: z.enum(PRIORITY_VALUES).default("normal"),
  offsets: z
    .array(z.coerce.number().int().min(0).max(MAX_OFFSET_DAYS))
    .max(20, "That's a lot of reminders — keep it to 20 or fewer."),
  recurrence: recurrenceSchema.default(null),
});

export type ReminderInput = z.infer<typeof reminderInputSchema>;

export const snoozeSchema = z.object({ until: isoDate });
export const renewSchema = z.object({
  newDate: isoDate,
  note: optionalText(500),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200, "That password is too long."),
  timezone: z.string().trim().max(64).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

/** Flatten zod issues into { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
