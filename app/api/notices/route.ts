import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { dismissNotices } from "@/lib/services/notices";
// Hides the platform's announcements shown so far for the signed-in member.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const member = await membership({ unapproved: true, unpaid: true });
    return Response.json(await dismissNotices(db, actorFromMember(member)));
  } catch (e) {
    return failure(e);
  }
}
