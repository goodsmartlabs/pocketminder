import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PocketMinder is a fully personal, authenticated app: every page depends on
  // the signed-in user, so we use the request-time rendering model rather than
  // Cache Components prerendering.
  cacheComponents: false,
  // Self-contained server bundle (.next/standalone) for Docker or any Node host.
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
