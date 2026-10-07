import type { SettingsView } from "../types";

/**
 * Delivery channels. A sent notification creates one delivery row per enabled
 * channel. Adding email or mobile push later means implementing `deliver` for
 * that channel and flipping `available` — the scheduler doesn't change.
 */

export type ChannelId = "in_app" | "browser" | "email" | "push";

export interface DeliveryPayload {
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  url: string;
}

export interface NotificationChannel {
  id: ChannelId;
  label: string;
  /** Implemented in this build. */
  available: boolean;
  isEnabled(settings: SettingsView): boolean;
  /**
   * Attempt delivery. Return "delivered" when done server-side, or "pending"
   * when the client pulls it (browser notifications are shown by the open tab).
   */
  deliver(payload: DeliveryPayload): Promise<"delivered" | "pending">;
}

export const CHANNELS: NotificationChannel[] = [
  {
    id: "in_app",
    label: "In-app",
    available: true,
    isEnabled: (s) => s.inAppEnabled,
    // The notification row itself is the in-app inbox entry.
    deliver: async () => "delivered",
  },
  {
    id: "browser",
    label: "Browser",
    available: true,
    isEnabled: (s) => s.browserEnabled,
    // Picked up by the open PocketMinder tab via /api/notifications/poll.
    deliver: async () => "pending",
  },
  {
    id: "email",
    label: "Email",
    available: false,
    isEnabled: (s) => s.emailEnabled,
    deliver: async () => {
      throw new Error("Email delivery is not configured yet.");
    },
  },
  {
    id: "push",
    label: "Mobile push",
    available: false,
    isEnabled: (s) => s.pushEnabled,
    deliver: async () => {
      throw new Error("Mobile push is not configured yet.");
    },
  },
];
