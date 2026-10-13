import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PocketMinder is a fully personal, authenticated app: every page depends on
  // the signed-in user, so we use the request-time rendering model rather than
  // Cache Components prerendering.
  cacheComponents: false,
  // Self-contained server bundle (.next/standalone) for Docker or any Node host.
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // Common guesses for the auth pages lead to the real ones instead of a 404.
  // Browsers ask for /favicon.ico on pages without an icon tag (e.g. JSON).
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
  async redirects() {
    const toLogin = ["/signin", "/sign-in", "/log-in", "/auth/login", "/auth/signin", "/account/login"];
    const toSignup = ["/sign-up", "/register", "/auth/signup", "/auth/register", "/account/signup"];
    return [
      ...toLogin.map((source) => ({ source, destination: "/login", permanent: false })),
      ...toSignup.map((source) => ({ source, destination: "/signup", permanent: false })),
    ];
  },
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
