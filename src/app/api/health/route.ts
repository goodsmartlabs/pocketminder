import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe for hosting platforms: checks the database too. */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({
      status: "ok",
      // Which commit is live (set automatically by the host; useful after a deploy).
      version: (
        process.env.VERCEL_GIT_COMMIT_SHA ??
        process.env.RAILWAY_GIT_COMMIT_SHA ??
        process.env.SOURCE_COMMIT ??
        "dev"
      ).slice(0, 7),
      auth: "form-post",
    });
  } catch (error) {
    console.error("PocketMinder database health check failed", error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
