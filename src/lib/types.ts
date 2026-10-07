import type { ISODate } from "./dates";
import type {
  Lifecycle,
  NotificationLevel,
  Priority,
  Recurrence,
  ReminderType,
  Status,
} from "./domain";

/** Serializable shapes passed from server to client components. */

export interface SpaceView {
 id: string; name: string; description: string | null; icon: string; color: string; status: "active" | "archived";
}

export interface CategoryView {
  spaceId: string;
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
  isDefault: boolean;
}

export interface ReminderView {
  spaceId: string;
  space: SpaceView;
  id: string;
  seriesId: string;
  cycle: number;
  title: string;
  description: string | null;
  importantDate: ISODate;
  category: CategoryView | null;
  reminderType: ReminderType;
  associatedWith: string | null;
  lifecycle: Lifecycle;
  status: Status;
  priority: Priority;
  recurrence: Recurrence | null;
  offsets: number[];
  snoozedUntil: ISODate | null;
  /** Days from today to the important date (negative when overdue). */
  daysRemaining: number;
  nextNotificationDate: ISODate | null;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  renewedAt: number | null;
  archivedAt: number | null;
}

export interface NotificationView {
  id: string;
  reminderId: string;
  kind: "advance" | "due" | "overdue" | "snooze";
  offsetDays: number | null;
  scheduledFor: ISODate;
  status: "pending" | "sent" | "skipped" | "cancelled";
  title: string | null;
  body: string | null;
  sentAt: number | null;
  readAt: number | null;
}

export interface AttachmentView {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
}

export interface RenewalView {
  id: string;
  kind: "renewal" | "recurrence";
  fromReminderId: string;
  toReminderId: string;
  previousDate: ISODate;
  newDate: ISODate;
  note: string | null;
  renewedAt: number;
}

export interface HistoryView {
  id: string;
  reminderId: string;
  event: string;
  detail: string | null;
  createdAt: number;
}

export interface PeriodView {
  id: string;
  cycle: number;
  importantDate: ISODate;
  lifecycle: Lifecycle;
}

export interface ReminderDetail {
  reminder: ReminderView;
  notifications: NotificationView[];
  attachments: AttachmentView[];
  renewals: RenewalView[];
  history: HistoryView[];
  periods: PeriodView[];
}

export interface SettingsView {
  defaultOffsets: number[];
  notificationLevel: NotificationLevel;
  inAppEnabled: boolean;
  browserEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  dayFirst: boolean;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
