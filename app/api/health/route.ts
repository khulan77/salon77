import { db } from "@/lib/db";
import { configured } from "@/lib/env";
export const dynamic = "force-dynamic";
// Uptime probe: reports only whether the app can reach its database.
export async function GET() {
  if (!configured)
    return Response.json({ status: "unconfigured" }, { status: 503 });
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "database_unavailable" }, { status: 503 });
  }
}
