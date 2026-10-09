import { z } from "zod";
import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { deliverSoon } from "@/lib/notifications/schedule";
import { dateSchema } from "@/lib/booking-validation";
import {
  createBooking,
  changeBooking,
  bookingView,
  readBooking,
  listBookings,
} from "@/lib/services/bookings";
const id = z.string().min(1).max(100);
export async function GET(request: Request) {
  try {
    const actor = actorFromMember(await membership()),
      q = new URL(request.url).searchParams;
    if (q.has("id"))
      return Response.json(await readBooking(db, actor, id.parse(q.get("id"))));
    const input = z
      .object({
        date: dateSchema,
        days: z.coerce.number().int().min(1).max(7).default(1),
        branchId: id.optional(),
        staffId: id.optional(),
      })
      .strict()
      .parse(Object.fromEntries(q));
    // Calendar polling doubles as a delivery tick for due reminders.
    deliverSoon();
    return Response.json(await listBookings(db, actor, input));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await membership());
    const booking = await createBooking(db, { actor }, await request.json());
    deliverSoon();
    return Response.json(await readBooking(db, actor, booking.id), {
      status: 201,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    deliverSoon();
    return Response.json(
      bookingView(
        await changeBooking(
          db,
          actorFromMember(await membership()),
          id.parse(new URL(request.url).searchParams.get("id")),
          await request.json(),
        ),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
