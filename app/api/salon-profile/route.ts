import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { updateSalonSocial } from "@/lib/services/salon-profile";
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    return Response.json(
      await updateSalonSocial(
        db,
        actorFromMember(await membership()),
        await request.json(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
