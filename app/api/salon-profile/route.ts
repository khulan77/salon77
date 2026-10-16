import { db } from "@/lib/db";
import { membership, setupAccess } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import {
  changeSalonSlug,
  updateSalonDetails,
  updateSalonSocial,
} from "@/lib/services/salon-profile";
// ?part=details edits name/phone/introduction, ?part=slug moves the booking
// link; without it the salon's social links are saved.
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const part = new URL(request.url).searchParams.get("part");
    const save =
      part === "details"
        ? updateSalonDetails
        : part === "slug"
          ? changeSalonSlug
          : updateSalonSocial;
    return Response.json(
      await save(
        db,
        actorFromMember(await membership(setupAccess)),
        await request.json(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
