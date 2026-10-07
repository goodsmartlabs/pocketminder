"use client";

import clsx from "clsx";
import {
  Archive,
  Folder,
  CalendarDays,
  Home,
  ListChecks,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApp } from "./AppContext";
import { NotificationBell } from "./Notifications";
import { useQuickCapture } from "./QuickCapture";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/spaces", label: "Spaces", icon: Folder },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reminders", label: "Reminders", icon: ListChecks },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={clsx("flex items-center gap-2.5", className)}
      aria-label="PocketMinder home"
    >
      <LogoMark className="size-8" />
      <span className="font-display text-[19px] font-semibold tracking-tight text-ink">
        PocketMinder
      </span>
    </Link>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="18" fill="var(--accent)" />
      <path
        d="M20 22a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6z"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="3.5"
      />
      <path d="M20 27h24" stroke="var(--accent-ink)" strokeWidth="3.5" />
      <circle cx="32" cy="37" r="3.5" fill="var(--accent-ink)" />
    </svg>
  );
}

export function RememberButton({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { open } = useQuickCapture();
  return (
    <button
      type="button"
      onClick={() => open()}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full bg-accent font-semibold text-accent-ink shadow-[0_6px_20px_-6px_var(--accent)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98]",
        compact ? "size-14" : "h-12 whitespace-nowrap px-5 text-[15px]",
        className,
      )}
      aria-label="Remember something"
    >
      <Plus className={compact ? "size-6" : "size-5"} strokeWidth={2.4} />
      {!compact && "Remember Something"}
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { userName } = useApp();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-bg px-4 py-6 lg:flex">
      <Logo className="px-2" />
      <RememberButton className="mt-8 w-full" />
      <nav className="mt-8 space-y-1" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                active
                  ? "bg-surface text-ink shadow-card"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon
                className={clsx(
                  "size-[18px]",
                  active ? "text-accent" : "text-ink-3",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-3">
        <p className="font-display text-[15px] italic leading-snug text-ink-3">
          Put it in your pocket.
          <br />
          Get it out of your head.
        </p>
        <p className="mt-4 truncate text-[13px] text-ink-3">
          Signed in as {userName}
        </p>
      </div>
    </aside>
  );
}

export function SearchBox(props: { className?: string; autoFocus?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === "/search" ? (params.get("q") ?? "") : "";
  // Re-mount when the URL query changes so the field reflects it.
  return <SearchForm key={current} initial={current} {...props} />;
}

function SearchForm({
  className,
  autoFocus,
  initial,
}: {
  className?: string;
  autoFocus?: boolean;
  initial: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  return (
    <form
      role="search"
      className={clsx("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        router.push(
          q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search",
        );
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Search visa, John, insurance, September…"
        aria-label="Search reminders"
        className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-[15px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
      />
    </form>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 hidden border-b border-line/60 bg-bg/85 backdrop-blur-md lg:block">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-8">
        <SearchBox className="max-w-md flex-1" />
        <SpaceSwitcher />
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}

export function SpaceSwitcher() {
  const { spaces } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const path = usePathname();
  const selected =
    path.startsWith("/spaces/") && !path.startsWith("/spaces/new")
      ? path.split("/")[2]
      : (params.get("space") ?? "");
  return (
    <select
      aria-label="Minder Space switcher"
      className="max-w-48 rounded-xl border border-line bg-surface px-2 py-2 text-sm"
      value={selected}
      onChange={(e) => {
        const id = e.target.value;
        const target =
          path === "/calendar" || path === "/reminders" ? path : "/";
        router.push(
          id
            ? target === "/"
              ? `/spaces/${id}`
              : `${target}?space=${id}`
            : target,
        );
      }}
    >
      <option value="">All Spaces</option>
      {spaces.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/85 backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center gap-1 px-4">
        <Logo />
        <div className="ml-auto flex items-center">
          <Link
            href="/search"
            className="inline-flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
            aria-label="Search"
          >
            <Search className="size-5" />
          </Link>
          <NotificationBell />
          <Link
            href="/settings"
            className="inline-flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
            aria-label="Settings"
          >
            <Settings className="size-5" />
          </Link>
        </div>
      </div>
      <div className="px-4 pb-2">
        <Suspense>
          <SpaceSwitcher />
        </Suspense>
      </div>
    </header>
  );
}

const MOBILE_NAV = [NAV[0], NAV[1], null, NAV[2], NAV[3], NAV[4]];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
      aria-label="Main"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-6 items-center px-2">
        {MOBILE_NAV.map((item) => {
          if (!item) {
            return (
              <div key="add" className="flex justify-center">
                <RememberButton compact className="-mt-7 ring-4 ring-bg" />
              </div>
            );
          }
          const { href, label, icon: Icon } = item;
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex flex-col items-center gap-1 py-1 text-[11px] font-medium",
                active ? "text-accent" : "text-ink-3",
              )}
            >
              <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
