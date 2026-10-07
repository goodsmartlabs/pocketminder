# PocketMinder

**Your brain for the dates you can't afford to forget.**
_Put it in your pocket. Get it out of your head._

PocketMinder is a focused date-memory and reminder system for expiries, renewals,
deadlines, bookings, payments, appointments and other important dates. Every day it
answers one question: **"What do I need to remember?"**

It is not a task manager, and it doesn't do projects, goals, habits or budgets.

## Features (V1)

- **Accounts**: email and password sign-up and sign-in (scrypt hashes, DB-backed sessions).
- **Quick capture**: type in plain language, for example _"Remind me 60 days before Grace's
  passport expires on May 18, 2028"_. PocketMinder pulls out the title, date, category,
  type, person or item, reminder schedule and recurrence, and shows them for you to
  confirm before saving. Press `n` anywhere to open it.
- **Manual form**: covers every field. It also has multiple advance reminders, with presets
  from 90 days to the day itself, plus custom timings.
- **Smart escalation**: the status updates automatically: Safe → Upcoming → Needs Attention →
  Urgent → Due Today → Overdue. The guidance escalates with it ("Start preparing",
  "Action needed", "Due next week"…). High-priority reminders escalate sooner.
- **Home dashboard**: a greeting, summary cards, the next item shown large, and then Overdue,
  Today, Coming Up and Later.
- **Timeline** on each reminder: Today → Preparation → Deadline, plus the next reminder date.
- **Calendar**: month view with indicators, a per-day list, a Today button, upcoming dates
  and category filters.
- **Register**: views for All, Upcoming, Overdue, Expiring Soon, Renewed, Resolved and Archived.
  Sort by closest, furthest, urgency, category or recently added. Search, and filter by
  category, type, person/item or status.
- **Renewals**: _Renew_ asks for the new date. The old period is kept and marked
  renewed, a new period starts with fresh reminders, and the renewal history is recorded.
- **Recurring dates**: weekly, monthly, every 3 or 6 months, annually, or a custom interval.
  Marking one done schedules the next occurrence.
- **Snooze**: tomorrow, 3 days, 1 week or a custom date. The important date never changes.
- **Notifications**: in-app inbox and browser notifications, with a choice of how often
  (every reminder, key milestones only, or the final week only). Anti-spam rules apply:
  at most one nudge per reminder per run, a backlog collapses to the latest notification,
  and several browser notifications at once become a single summary. Overdue items
  resurface weekly until resolved.
- **Attachments**: PDFs, images and Office files up to 10 MB, stored on disk behind a
  `FileStorage` interface.
- **Universal search**: finds reminders by title, notes, person or item, category, type,
  status, month or year ("visa", "John", "September").
- **Password safety**: PocketMinder tracks *when* a password needs changing, never the
  password itself. Notes that look like secrets (`password: …`) are rejected.
- Works on phones first, with a bottom tab bar and a prominent **+ Remember Something**
  button. Light and dark themes are included, along with loading, error and empty states.

## Stack

- Next.js 16 (App Router, Server Components and Server Actions), React 19, TypeScript
- Tailwind CSS v4 with design tokens in `src/app/globals.css`
- SQLite via better-sqlite3 + Drizzle ORM. Migrations live in `drizzle/` and run on startup.
- chrono-node for natural-language date parsing, and zod for validation
- Vitest for unit and service tests

## Getting started

```bash
npm install
npm run dev            # http://localhost:3000
```

The database is created automatically at `./data/pocketminder.db`. Copy `.env.example`
to `.env.local` to change the location.

```bash
npm test               # parser, status, scheduling and service tests
npm run lint
npm run typecheck
npm run build && npm start
```

After changing `src/lib/db/schema.ts`, run `npm run db:generate` to create a migration.

## Architecture

```
src/
  app/
    (auth)/            login, signup
    (app)/             Home, Calendar, Reminders, Archive, Settings, Search, Notifications
    actions/           server actions (validated with zod, always scoped to the signed-in user)
    api/               notification polling, attachment upload/download, cron endpoint
  components/          shell (nav, quick capture, notifications), reminders, calendar, settings, ui
  lib/
    db/schema.ts       data model
    parser.ts          natural-language quick capture
    status.ts          urgency + escalation rules
    notifications/     pure scheduling rules + delivery channel registry
    dates.ts, domain.ts, register.ts, dashboard.ts, search.ts, validation.ts
  server/              data access: reminders (CRUD, renew, recur, snooze) and notifications
```

### Data model

| Table | Purpose |
| --- | --- |
| `users`, `sessions`, `user_settings` | Accounts, hashed session tokens, preferences |
| `categories` | Default and custom categories per user |
| `reminders` | One **period** of something to remember. `series_id` links every renewal or recurrence, and `status` is the lifecycle (active / resolved / renewed / archived). Urgency is derived from the date. |
| `reminder_notifications` | Notification records generated from each reminder's offsets (`advance`, `due`, `overdue`, `snooze`) |
| `notification_deliveries` | One row per channel per sent notification (`in_app`, `browser`, later `email` / `push`) |
| `renewals` | Renewal history: from and to period, previous and new date, note |
| `reminder_history` | Activity log (created, edited, snoozed, renewed, resolved…) |
| `attachments` | File metadata, with bytes held in `FileStorage` |

### Notifications

`processDueNotifications` (in `src/server/notifications.ts`) runs whenever the open app
polls `/api/notifications/poll` (every 60 seconds and on focus). To process every user
without a browser open, which email or push will need, call
`GET /api/cron/notifications` with `Authorization: Bearer $CRON_SECRET`.

To add a channel, implement `deliver` for it in `src/lib/notifications/channels.ts` and
set `available: true`. The scheduler doesn't need to change.
