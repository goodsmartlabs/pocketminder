"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Read a browser-only value (time zone, permission, localStorage) without a
 * hydration mismatch: the server snapshot is used for SSR and hydration.
 * `read` must return a stable value (primitive or cached object).
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}
