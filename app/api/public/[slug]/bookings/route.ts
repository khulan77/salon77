import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { createBooking, publicReceipt } from "@/lib/services/bookings";
import { guardPublic } from "@/lib/rate-limit";
import { deliverSoon } from "@/lib/notifications/schedule";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    sameOrigin(request);
    const { slug } = await params;
    await guardPublic(db, request, slug, "booking");
    const booking = await createBooking(db, { slug }, await request.json());
    deliverSoon();
    return Response.json(await publicReceipt(db, booking), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
