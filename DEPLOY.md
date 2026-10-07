# Deploying PocketMinder

PocketMinder is a single Node.js server with a SQLite database. Any host that can run a
**Docker container with a persistent volume** works: a VPS, Railway, Render, Fly.io and so on.

> **Persistent storage is required.** The database and attachments live in `/data` inside the
> container. Mount a volume there, or every redeploy wipes all accounts and reminders.
> Serverless hosts such as Vercel and Netlify have no persistent disk and are **not** suitable.

## Requirements

| Item | Value |
| --- | --- |
| Runtime | Docker (or Node.js 22 when not using Docker) |
| Port | `3000` (override with `PORT`) |
| Persistent volume | mounted at `/data` (about 1 GB is plenty) |
| Health check | `GET /api/health` returns `{"status":"ok"}` (it also checks the database) |
| HTTPS | Required in production: session cookies are `Secure` |

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `POCKETMINDER_DATA_DIR` | no | `/data` in Docker | Where the SQLite DB and uploads are stored |
| `CRON_SECRET` | recommended | none | Protects `GET /api/cron/notifications` |
| `COOKIE_SECURE` | no | `true` in production | Set to `false` **only** when serving over plain HTTP |
| `PORT` | no | `3000` | Listening port |

There are no external services, API keys or separate database server to set up. Database
migrations run automatically on startup.

## Option A: Docker on a VPS (e.g. `pocketminder.innergency.com`)

```bash
git clone https://github.com/goodsmartlabs/pocketminder.git
cd pocketminder
git checkout claude/pocketminder-web-app-y4mqmx   # or main once merged
echo "CRON_SECRET=$(openssl rand -hex 24)" > .env
docker compose up -d --build
curl http://localhost:3000/api/health            # {"status":"ok"}
```

Then put HTTPS in front of it. For example, with Caddy (automatic Let's Encrypt
certificates), add this to `/etc/caddy/Caddyfile`:

```
pocketminder.innergency.com {
    reverse_proxy localhost:3000
}
```

Finally, add a DNS **A record** for `pocketminder` pointing to the server's IP address.

If you use nginx instead, forward the original host so form submissions (Server Actions)
pass Next.js's origin check:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Option B: a platform (Railway, Render, Fly.io)

1. Create a service from this GitHub repo. The platform detects the `Dockerfile`.
2. Attach a persistent volume mounted at **`/data`**.
3. Set `CRON_SECRET` to a random value.
4. Set the health check path to `/api/health`.
5. Add the custom domain (e.g. `pocketminder.innergency.com`) in the platform dashboard,
   then create the CNAME record it shows at your DNS provider.

## Option C: plain Node.js (no Docker)

```bash
npm ci
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r drizzle .next/standalone/drizzle
cd .next/standalone
POCKETMINDER_DATA_DIR=/var/lib/pocketminder NODE_ENV=production node server.js
```

Run it under a process manager (systemd or pm2) behind an HTTPS reverse proxy, as in Option A.

## Notifications cron (optional, recommended)

In-app and browser notifications are processed whenever someone has the app open. To
process every user on a schedule, call this hourly:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://pocketminder.innergency.com/api/cron/notifications
```

## Backups

Everything lives in the `/data` volume: `pocketminder.db` (with its `-wal` and `-shm`
files) and `uploads/`. To take a consistent copy of the database while the app runs:

```bash
docker compose exec pocketminder node -e "require('better-sqlite3')('/data/pocketminder.db').backup('/data/backup.db')"
```

## Verifying a deployment

1. `GET /api/health` returns `{"status":"ok"}`.
2. Open `/signup`, create an account and add a reminder with **Remember Something**.
3. Redeploy and sign in again. If the reminder is still there, the volume is mounted correctly.
