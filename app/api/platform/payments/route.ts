import { z } from "zod";
import { db } from "@/lib/db";
import { identity } from "@/lib/auth";
import { failure, sameOrigin } from "@/lib/http";
import { recordPayment } from "@/lib/services/billing";
// The operator records a received monthly fee; access extends by 30 days.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    const id = z
      .string()
      .min(1)
      .max(100)
      .parse(new URL(request.url).searchParams.get("id"));
    return Response.json(
      await recordPayment(db, user.id, id, await request.json()),
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
