# PocketMinder production image
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Toolchain for better-sqlite3 if no prebuilt binary is available.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    POCKETMINDER_DATA_DIR=/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
RUN mkdir -p /data && chown -R node:node /data /app
# Initialize mounted volume ownership, then drop privileges before starting the app.
# SQLite database and attachments live here: mount a persistent volume.
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","-e","const fs=require('node:fs');const data=process.env.POCKETMINDER_DATA_DIR||'/data';fs.mkdirSync(data,{recursive:true});fs.chownSync(data,1000,1000);process.setgid(1000);process.setuid(1000);require('./server.js');"]
