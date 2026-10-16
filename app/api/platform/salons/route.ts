import { z } from "zod";
import { db } from "@/lib/db";
import { identity } from "@/lib/auth";
import { failure, sameOrigin } from "@/lib/http";
import {
  approvalRecipient,
  deleteSalon,
  reviewSalon,
  setSalonStatus,
} from "@/lib/services/platform";
import {
  notifySalonApproved,
  notifySalonRejected,
} from "@/lib/notifications/platform-email";
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
      } else if (result.reviewStatus === "REJECTED" && body.note) {
        const { to, salon } = await approvalRecipient(db, id);
        notifySalonRejected(to, { name: salon.name, note: String(body.note) });
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
// Deletes a salon for good; the body repeats the salon's name to confirm.
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    const id = z
      .string()
      .min(1)
      .max(100)
      .parse(new URL(request.url).searchParams.get("id"));
    return Response.json(
      await deleteSalon(db, user.id, id, await request.json()),
    );
  } catch (e) {
    return failure(e);
  }
}
