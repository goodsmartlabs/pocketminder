"use client";

import clsx from "clsx";
import { Bell, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import {
  addCategoryAction,
  changePasswordAction,
  deleteCategoryAction,
  updatePreferencesAction,
  updateProfileAction,
} from "@/app/actions/settings";
import { NOTIFICATION_LEVELS } from "@/lib/domain";
import { useClientValue } from "@/lib/useClientValue";
import type { ActionResult, CategoryView, SettingsView } from "@/lib/types";
import { OffsetPicker } from "../reminders/ReminderFields";
import { Button, Card, Field, Input, Select } from "../ui/primitives";
import { useToast } from "../ui/Toast";

function useSave() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast.show(r.message);
        onOk?.();
        router.refresh();
      } else toast.show(r.error, "error");
    });
  return { save, pending };
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1 text-[14px] text-ink-2">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  badge,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <label
      className={clsx(
        "flex items-start justify-between gap-4 py-3",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <span>
        <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
          {label}
          {badge && (
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-ink-2">
              {badge}
            </span>
          )}
        </span>
        {description && <span className="mt-0.5 block text-[13px] text-ink-3">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-surface-3 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */

const EMPTY: string[] = [];
let zoneCache: string[] | null = null;
function supportedTimeZones(): string[] {
  if (!zoneCache) {
    try {
      zoneCache =
        (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
          "timeZone",
        ) ?? EMPTY;
    } catch {
      zoneCache = EMPTY;
    }
  }
  return zoneCache;
}
function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function ProfileSection({
  name,
  email,
  timezone,
}: {
  name: string;
  email: string;
  timezone: string;
}) {
  const { save, pending } = useSave();
  const [n, setN] = useState(name);
  const [tz, setTz] = useState(timezone);
  const allZones = useClientValue(supportedTimeZones, EMPTY);
  const zones = Array.from(new Set([timezone, tz, "UTC", ...allZones]));
  const browserTz = useClientValue(deviceTimeZone, null);

  return (
    <Section title="Profile">
      <form
        className="grid gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save(() => updateProfileAction({ name: n, timezone: tz }));
        }}
      >
        <Field label="Name" htmlFor="name">
          <Input id="name" value={n} onChange={(e) => setN(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" value={email} disabled readOnly />
        </Field>
        <Field
          label="Time zone"
          htmlFor="tz"
          className="sm:col-span-2"
          hint={
            browserTz && browserTz !== tz ? (
              <button type="button" className="text-accent hover:underline" onClick={() => setTz(browserTz)}>
                Use this device&apos;s time zone ({browserTz})
              </button>
            ) : (
              "Decides when “today” begins for your countdowns."
            )
          }
        >
          <Select id="tz" value={tz} onChange={(e) => setTz(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" loading={pending}>
            Save profile
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export function PreferencesSection({ settings }: { settings: SettingsView }) {
  const { save, pending } = useSave();
  const toast = useToast();
  const [prefs, setPrefs] = useState(settings);
  const [requested, setPermission] = useState<NotificationPermission | null>(null);
  const initialPermission = useClientValue<NotificationPermission | "unsupported">(
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
    "default",
  );
  const permission = requested ?? initialPermission;

  const set = <K extends keyof SettingsView>(k: K, v: SettingsView[K]) =>
    setPrefs((p) => ({ ...p, [k]: v }));

  const enableBrowser = async (on: boolean) => {
    if (!on) return set("browserEnabled", false);
    if (typeof Notification === "undefined") {
      toast.show("This browser doesn't support notifications.", "error");
      return;
    }
    const result =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") set("browserEnabled", true);
    else toast.show("Notifications are blocked in your browser settings.", "error");
  };

  const test = () => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification("PocketMinder", {
      body: "This is how a reminder will look. Calm, and right on time.",
      icon: "/icon.svg",
    });
  };

  return (
    <>
      <Section
        title="Notifications"
        description="How PocketMinder reaches you as dates get closer. It never sends more than one nudge per reminder per day."
      >
        <div className="divide-y divide-line">
          <Toggle
            label="In-app notifications"
            description="Shown in the bell and on your dashboard."
            checked={prefs.inAppEnabled}
            onChange={(v) => set("inAppEnabled", v)}
          />
          <Toggle
            label="Browser notifications"
            description={
              permission === "denied"
                ? "Blocked in this browser. Allow notifications for this site to turn them on."
                : permission === "unsupported"
                  ? "Not supported in this browser."
                  : "Pop-up notifications while PocketMinder is open in a tab."
            }
            checked={prefs.browserEnabled}
            onChange={enableBrowser}
            disabled={permission === "unsupported"}
          />
          <Toggle label="Email" badge="Coming soon" checked={false} onChange={() => {}} disabled />
          <Toggle label="Mobile push" badge="Coming soon" checked={false} onChange={() => {}} disabled />
        </div>
        {prefs.browserEnabled && permission === "granted" && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={test}>
            <Bell className="size-4" /> Send a test notification
          </Button>
        )}

        <fieldset className="mt-6">
          <legend className="text-[13px] font-medium text-ink-2">How often</legend>
          <div className="mt-2 space-y-2">
            {NOTIFICATION_LEVELS.map((l) => (
              <label
                key={l.value}
                className={clsx(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                  prefs.notificationLevel === l.value
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:border-line-strong",
                )}
              >
                <input
                  type="radio"
                  name="level"
                  value={l.value}
                  checked={prefs.notificationLevel === l.value}
                  onChange={() => set("notificationLevel", l.value)}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-[15px] font-medium text-ink">{l.label}</span>
                  <span className="block text-[13px] text-ink-3">{l.description}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-ink-3">
            Due-today and overdue reminders always come through. Overdue items resurface weekly
            until you resolve them.
          </p>
        </fieldset>
      </Section>

      <Section
        title="Reminder defaults"
        description="Used when you add a reminder with the form. Quick capture picks sensible timing for the type of date."
      >
        <Field label="Default advance reminders">
          <OffsetPicker value={prefs.defaultOffsets} onChange={(o) => set("defaultOffsets", o)} />
        </Field>
        <div className="mt-5">
          <Toggle
            label="Day comes first in dates"
            description="Read 03/04 as 3 April. Turn off to read it as March 4 (US style)."
            checked={prefs.dayFirst}
            onChange={(v) => set("dayFirst", v)}
          />
        </div>
      </Section>

      <div className="sticky bottom-20 z-20 flex justify-end lg:bottom-4">
        <Button
          size="lg"
          loading={pending}
          onClick={() =>
            save(() =>
              updatePreferencesAction({
                notificationLevel: prefs.notificationLevel,
                inAppEnabled: prefs.inAppEnabled,
                browserEnabled: prefs.browserEnabled,
                dayFirst: prefs.dayFirst,
                defaultOffsets: prefs.defaultOffsets,
              }),
            )
          }
        >
          Save preferences
        </Button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

type Theme = "system" | "light" | "dark";

function savedTheme(): Theme {
  try {
    const t = localStorage.getItem("pm-theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  try {
    if (t === "system") localStorage.removeItem("pm-theme");
    else localStorage.setItem("pm-theme", t);
  } catch {}
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

export function AppearanceSection() {
  const saved = useClientValue(savedTheme, "system");
  const [chosen, setTheme] = useState<Theme | null>(null);
  const theme = chosen ?? saved;
  const choose = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };
  const options = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ] as const;
  return (
    <Section title="Appearance">
      <div className="grid grid-cols-3 gap-2">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={theme === value}
            className={clsx(
              "flex flex-col items-center gap-2 rounded-xl border py-4 text-[14px] font-medium transition-colors",
              theme === value
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-ink-2 hover:border-line-strong",
            )}
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export function CategoriesSection({ categories }: { categories: CategoryView[] }) {
  const { save, pending } = useSave();
  const [name, setName] = useState("");
  return (
    <Section
      title="Categories"
      description="The defaults cover most things. Add your own for anything else."
    >
      <ul className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <li
            key={c.id}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-line pl-3 pr-1.5 text-[14px] text-ink"
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
            {c.isDefault ? (
              <span className="pr-1.5" />
            ) : (
              <button
                type="button"
                onClick={() => save(() => deleteCategoryAction(c.id))}
                className="rounded-full p-1 text-ink-3 hover:bg-surface-2 hover:text-critical"
                aria-label={`Remove ${c.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save(() => addCategoryAction(name), () => setName(""));
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category, e.g. Fleet"
          maxLength={40}
          aria-label="New category name"
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary" loading={pending} className="h-11">
          Add
        </Button>
      </form>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export function SecuritySection() {
  const { save, pending } = useSave();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  return (
    <Section
      title="Account security"
      description="Your PocketMinder sign-in. Remember: PocketMinder tracks when passwords need changing — it never stores the passwords themselves."
    >
      <form
        className="grid gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save(
            () => changePasswordAction({ current, next }),
            () => {
              setCurrent("");
              setNext("");
            },
          );
        }}
      >
        <Field label="Current password" htmlFor="current">
          <Input
            id="current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="New password" htmlFor="next" hint="At least 8 characters.">
          <Input
            id="next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" variant="secondary" loading={pending} disabled={!current || !next}>
            Change password
          </Button>
        </div>
      </form>
      <form action={logoutAction} className="mt-6 border-t border-line pt-5">
        <Button type="submit" variant="ghost" className="-ml-3 text-critical hover:text-critical">
          Sign out
        </Button>
      </form>
    </Section>
  );
}
