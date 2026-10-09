import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure } from "@/lib/http";
import { readNotificationLog } from "@/lib/services/notifications";
export async function GET() {
  try {
    return Response.json(
      await readNotificationLog(db, actorFromMember(await membership())),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
