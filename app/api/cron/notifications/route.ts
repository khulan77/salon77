import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { smsProvider } from "@/lib/notifications/provider";
import { processNotifications } from "@/lib/notifications/dispatch";
import { completePastBookings } from "@/lib/services/auto-complete";
// Retries queued notices and closes past visits; call from a scheduler with "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    given.length !== expected.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  )
    return Response.json({ error: "Зөвшөөрөлгүй." }, { status: 401 });
  const completed = await completePastBookings(db);
  return Response.json({
    ...(await processNotifications(db, smsProvider(), { limit: 100 })),
    completed,
  });
}
