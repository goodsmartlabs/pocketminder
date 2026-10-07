"use client";

import { createContext, useContext } from "react";
import type { ISODate } from "@/lib/dates";
import type { CategoryView } from "@/lib/types";

export interface AppContextValue {
  userName: string;
  today: ISODate;
  timezone: string;
  dayFirst: boolean;
  categories: CategoryView[];
  defaultOffsets: number[];
  browserNotifications: boolean;
}

const Ctx = createContext<AppContextValue | null>(null);

export function AppContextProvider({
  value,
  children,
}: {
  value: AppContextValue;
  children: React.ReactNode;
}) {
  return <Ctx value={value}>{children}</Ctx>;
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppContextProvider");
  return v;
}
