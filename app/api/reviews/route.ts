import { z } from "zod";
import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { listReviews, setReviewHidden } from "@/lib/services/reviews";
export async function GET() {
  try {
    return Response.json(
      await listReviews(db, actorFromMember(await membership())),
    );
  } catch (e) {
    return failure(e);
  }
}
// PATCH ?id= { hidden }: hide a review from the booking page, or show it.
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const id = z
      .string()
      .min(1)
      .max(100)
      .parse(new URL(request.url).searchParams.get("id"));
    return Response.json(
      await setReviewHidden(
        db,
        actorFromMember(await membership()),
        id,
        await request.json(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
