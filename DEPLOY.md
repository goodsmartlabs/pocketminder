# Deploying PocketMinder

PocketMinder is a Next.js app backed by **Postgres**. The production setup is:

- **Vercel**: builds and hosts the app from GitHub (`goodsmartlabs/pocketminder`, branch `main`).
- **Supabase**: the Postgres database (project `PocketMinder`). Attachments are stored in the
  database too, so the app needs no disk.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. On Supabase use the **Transaction pooler** URI (port `6543`). |
| `CRON_SECRET` | recommended | Protects `GET /api/cron/notifications`. Vercel Cron sends it automatically. |
| `DATABASE_POOL_SIZE` | no | Connections per server instance (default `5`). |
| `COOKIE_SECURE` | no | Set to `false` **only** when serving over plain HTTP. |

## Database setup (once)

Apply the SQL files in `drizzle/` in order (Supabase SQL editor, `psql`, or the Supabase MCP):

1. `drizzle/0000_init.sql`: tables, foreign keys and indexes
2. `drizzle/0001_enable_rls.sql`: turns on Row Level Security with no policies, so Supabase's public
   Data API (anon key) cannot read anything. The app connects as the database owner and is
   unaffected.

After changing `src/lib/db/schema.ts`, run `npm run db:generate` and apply the new file.

## Vercel

1. Import the GitHub repo in Vercel (framework preset: Next.js; no build settings needed).
2. Add `DATABASE_URL` and `CRON_SECRET` under **Settings → Environment Variables** (Production),
   then redeploy.
3. **Settings → Domains**: add `pocketminder.innergency.com` and create the DNS record Vercel shows
   (a `CNAME` to `cname.vercel-dns.com` for a subdomain).
4. Check `https://pocketminder.innergency.com/api/health` → `{"status":"ok", ...}`.

`vercel.json` schedules the notification job daily (the Hobby plan allows one run per day).
In-app and browser notifications also update whenever a user opens the app.

## Docker / any Node host

`Dockerfile` builds a standalone server (`STANDALONE=1`). It needs `DATABASE_URL`.
`docker compose up -d --build` starts the app with a local Postgres; apply `drizzle/*.sql` to it once.

## Useful commands

```bash
DATABASE_URL=... npm run accounts   # list accounts (read-only)
npm test                            # unit + service tests (in-memory Postgres via PGlite)
```
