import { db } from "@/lib/db";
import { identity } from "@/lib/auth";
import { failure, sameOrigin } from "@/lib/http";
import { setPricePerBranch } from "@/lib/services/billing";
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    return Response.json(
      await setPricePerBranch(db, user.id, await request.json()),
    );
  } catch (e) {
    return failure(e);
  }
}
