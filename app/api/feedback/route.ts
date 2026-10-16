import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { listOwnFeedback, sendFeedback } from "@/lib/services/feedback";
import { notifyFeedback } from "@/lib/notifications/platform-email";
import { FEEDBACK_KINDS, type FeedbackKind } from "@/lib/feedback";
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
    const member = await membership();
    const list = await sendFeedback(
      db,
      actorFromMember(member),
      await request.json(),
    );
    // The newest request comes first; tell the operator about it.
    const sent = list[0];
    if (sent)
      notifyFeedback({
        salonName: member.salon.name,
        author: member.user.name || member.user.email,
        kind: FEEDBACK_KINDS[sent.kind as FeedbackKind] ?? sent.kind,
        message: sent.message,
      });
    return Response.json(list, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
