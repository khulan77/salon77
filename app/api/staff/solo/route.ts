import { tenant, setupAccess } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { setupSoloOwner } from "@/lib/services/staff";
// "I serve clients myself": the owner becomes a staff member with hours.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return Response.json(
      await setupSoloOwner(db, actorFromMember(await tenant(setupAccess))),
    );
  } catch (e) {
    return failure(e);
  }
}
