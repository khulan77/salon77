import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { HttpError } from "@/lib/errors";
import { failure, sameOrigin } from "@/lib/http";
import { deliverSoon } from "@/lib/notifications/schedule";
import { bookingView, readBooking } from "@/lib/services/bookings";
import { createDeskVisit, deskVisitAvailability } from "@/lib/services/visits";
// Desk bookings of one or two services that start together.
export async function GET(request: Request) {
  try {
    const actor = actorFromMember(await membership()),
      q = new URL(request.url).searchParams;
    let items: unknown;
    try {
      items = JSON.parse(q.get("items") ?? "[]");
    } catch {
      throw new HttpError(400, "Үйлчилгээгээ сонгоно уу.");
    }
    return Response.json(
      await deskVisitAvailability(db, actor, {
        branchId: q.get("branchId"),
        date: q.get("date"),
        items,
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await membership());
    const created = await createDeskVisit(db, actor, await request.json());
    deliverSoon();
    const first = await readBooking(db, actor, created[0].id);
    return Response.json(
      { ...first, bookings: created.map((b) => bookingView(b)) },
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
