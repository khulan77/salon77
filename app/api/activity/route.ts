import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { markInboxSeen, readInbox } from "@/lib/services/activity";
export async function GET() {
  try {
    return Response.json(
      await readInbox(db, actorFromMember(await membership())),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
// Marks everything up to now as read for the signed-in member.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return Response.json(
      await markInboxSeen(db, actorFromMember(await membership())),
    );
  } catch (e) {
    return failure(e);
  }
}
