import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { HttpError } from "@/lib/errors";
import { failure, sameOrigin } from "@/lib/http";
import { bylClient } from "@/lib/payments/byl";
import { openCheckout } from "@/lib/services/billing";
// The owner's Byl payment page for the monthly fee; reachable after access ran out.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const byl = bylClient();
    if (!byl)
      throw new HttpError(404, "Онлайн төлбөр хараахан идэвхжээгүй байна.");
    return Response.json(
      await openCheckout(
        db,
        actorFromMember(await membership({ unpaid: true })),
        byl,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
