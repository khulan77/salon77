import { z } from "zod";
import { db } from "@/lib/db";
import { identity } from "@/lib/auth";
import { failure, sameOrigin } from "@/lib/http";
import {
  approvalRecipient,
  reviewSalon,
  setSalonStatus,
} from "@/lib/services/platform";
import { notifySalonApproved } from "@/lib/notifications/platform-email";
import { setSalonPrice } from "@/lib/services/billing";
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
    if (body && typeof body === "object" && "decision" in body) {
      const result = await reviewSalon(db, user.id, id, body);
      if (result.approvedNow) {
        const { to, salon } = await approvalRecipient(db, id);
        notifySalonApproved(to, salon);
      }
      return Response.json(result);
    }
    if (body && typeof body === "object" && "monthlyPriceMnt" in body)
      return Response.json(await setSalonPrice(db, user.id, id, body));
    return Response.json(await setSalonStatus(db, user.id, id, body));
  } catch (e) {
    return failure(e);
  }
}
