import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { chooseRenewal } from "@/lib/services/billing";
// The owner's continue/stop answer; reachable after access ran out.
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    return Response.json(
      await chooseRenewal(
        db,
        actorFromMember(await membership({ unpaid: true })),
        await request.json(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
