import { z } from "zod";
import { db } from "@/lib/db";
import { identity } from "@/lib/auth";
import { failure, sameOrigin } from "@/lib/http";
import { setSalonStatus } from "@/lib/services/platform";
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    const id = z
      .string()
      .min(1)
      .max(100)
      .parse(new URL(request.url).searchParams.get("id"));
    // setSalonStatus re-checks the super-admin flag inside its transaction.
    return Response.json(
      await setSalonStatus(db, user.id, id, await request.json()),
    );
  } catch (e) {
    return failure(e);
  }
}
