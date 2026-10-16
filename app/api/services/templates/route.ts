import { tenant, setupAccess } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { addServiceTemplates } from "@/lib/services/catalog";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await tenant(setupAccess));
    return Response.json(
      await addServiceTemplates(db, actor, await request.json()),
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
