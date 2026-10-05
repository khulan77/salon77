import { tenant } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { updateMember, recordId } from "@/lib/services/team";
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await tenant());
    const id = recordId.parse(new URL(request.url).searchParams.get("id"));
    await updateMember(db, actor, id, await request.json());
    return Response.json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
