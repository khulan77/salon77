import { z } from "zod";
import { db } from "@/lib/db";
import { identity } from "@/lib/auth";
import { failure, sameOrigin } from "@/lib/http";
import { reviewSalon, setSalonStatus } from "@/lib/services/platform";
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    const id = z
      .string()
      .min(1)
      .max(100)
      .parse(new URL(request.url).searchParams.get("id"));
    const body = await request.json();
    // Both re-check the super-admin flag inside their transaction.
    return Response.json(
      body && typeof body === "object" && "decision" in body
        ? await reviewSalon(db, user.id, id, body)
        : await setSalonStatus(db, user.id, id, body),
    );
  } catch (e) {
    return failure(e);
  }
}
