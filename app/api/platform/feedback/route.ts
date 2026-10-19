import { z } from "zod";
import { db } from "@/lib/db";
import { platformAdmin } from "@/lib/auth";
import { failure, sameOrigin } from "@/lib/http";
import { answerFeedback } from "@/lib/services/feedback";
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await platformAdmin();
    const id = z
      .string()
      .min(1)
      .max(100)
      .parse(new URL(request.url).searchParams.get("id"));
    // answerFeedback re-checks the super-admin flag inside its transaction.
    return Response.json(
      await answerFeedback(db, user.id, id, await request.json()),
    );
  } catch (e) {
    return failure(e);
  }
}
