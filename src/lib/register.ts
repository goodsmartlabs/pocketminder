import { matchesText } from "./search";
import { URGENCY_RANK } from "./status";
import type { ReminderView } from "./types";

export const REGISTER_VIEWS = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "expiring", label: "Expiring Soon" },
  { value: "renewed", label: "Renewed" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
] as const;

/** Extra views reachable from dashboard cards. */
export const HIDDEN_VIEWS = [
  { value: "attention", label: "Needs Attention" },
  { value: "next7", label: "Next 7 Days" },
  { value: "next30", label: "Next 30 Days" },
] as const;

export const SORTS = [
  { value: "closest", label: "Closest date" },
  { value: "furthest", label: "Furthest date" },
  { value: "urgency", label: "Urgency" },
  { value: "category", label: "Category" },
  { value: "recent", label: "Recently added" },
] as const;

export type RegisterView =
  | (typeof REGISTER_VIEWS)[number]["value"]
  | (typeof HIDDEN_VIEWS)[number]["value"];
export type RegisterSort = (typeof SORTS)[number]["value"];

export interface RegisterQuery {
  view: RegisterView;
  sort: RegisterSort;
  q: string;
  category: string;
  type: string;
  who: string;
  status: string;
}

const VIEW_VALUES = new Set<string>([
  ...REGISTER_VIEWS.map((v) => v.value),
  ...HIDDEN_VIEWS.map((v) => v.value),
]);
const SORT_VALUES = new Set<string>(SORTS.map((s) => s.value));

export const EXPIRING_SOON_DAYS = 30;

export function parseRegisterQuery(sp: Record<string, string | string[] | undefined>): RegisterQuery {
  const get = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.slice(0, 200) ?? "";
  };
  const view = get("view");
  const sort = get("sort");
  return {
    view: (VIEW_VALUES.has(view) ? view : "all") as RegisterView,
    sort: (SORT_VALUES.has(sort) ? sort : "closest") as RegisterSort,
    q: get("q"),
    category: get("category"),
    type: get("type"),
    who: get("who"),
    status: get("status"),
  };
}

function inView(r: ReminderView, view: RegisterView): boolean {
  const active = r.lifecycle === "active";
  switch (view) {
    case "all":
      return r.lifecycle !== "archived";
    case "upcoming":
      return active && r.daysRemaining >= 0;
    case "overdue":
      return active && r.daysRemaining < 0;
    case "expiring":
      return active && r.daysRemaining >= 0 && r.daysRemaining <= EXPIRING_SOON_DAYS;
    case "renewed":
      return r.lifecycle === "renewed";
    case "resolved":
      return r.lifecycle === "resolved";
    case "archived":
      return r.lifecycle === "archived";
    case "attention":
      return active && ["needs_attention", "urgent", "due_today"].includes(r.status);
    case "next7":
      return active && r.daysRemaining >= 0 && r.daysRemaining <= 7;
    case "next30":
      return active && r.daysRemaining >= 0 && r.daysRemaining <= 30;
  }
}

export function applyRegister(reminders: ReminderView[], q: RegisterQuery): ReminderView[] {
  const list = reminders.filter(
    (r) =>
      inView(r, q.view) &&
      (!q.category || r.category?.id === q.category) &&
      (!q.type || r.reminderType === q.type) &&
      (!q.who || (r.associatedWith ?? "").toLowerCase() === q.who.toLowerCase()) &&
      (!q.status || r.status === q.status) &&
      matchesText(r, q.q),
  );
  const byDate = (a: ReminderView, b: ReminderView) =>
    a.importantDate.localeCompare(b.importantDate) || a.title.localeCompare(b.title);
  switch (q.sort) {
    case "closest":
      return list.sort(byDate);
    case "furthest":
      return list.sort((a, b) => byDate(b, a));
    case "urgency":
      return list.sort(
        (a, b) =>
          URGENCY_RANK[a.status] - URGENCY_RANK[b.status] ||
          a.daysRemaining - b.daysRemaining,
      );
    case "category":
      return list.sort(
        (a, b) => (a.category?.name ?? "~").localeCompare(b.category?.name ?? "~") || byDate(a, b),
      );
    case "recent":
      return list.sort((a, b) => b.createdAt - a.createdAt);
  }
}
