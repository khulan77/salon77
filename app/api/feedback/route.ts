import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { listOwnFeedback, sendFeedback } from "@/lib/services/feedback";
export async function GET() {
  try {
    return Response.json(
      await listOwnFeedback(db, actorFromMember(await membership())),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await membership());
    return Response.json(await sendFeedback(db, actor, await request.json()), {
      status: 201,
    });
  } catch (e) {
    return failure(e);
  }
}
