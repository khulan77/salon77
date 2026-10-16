import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { storageConfig } from "@/lib/storage";
export const dynamic = "force-dynamic";
// Uptime probe: whether the app reaches its database and can store photos.
export async function GET() {
  if (!configured)
    return Response.json({ status: "unconfigured" }, { status: 503 });
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      {
        status: "ok",
        storage: storageConfig().ok ? "ready" : "unconfigured",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "database_unavailable" }, { status: 503 });
  }
}
