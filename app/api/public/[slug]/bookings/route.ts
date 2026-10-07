import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { createBooking, publicReceipt } from "@/lib/services/bookings";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    sameOrigin(request);
    const booking = await createBooking(
      db,
      { slug: (await params).slug },
      await request.json(),
    );
    return Response.json(await publicReceipt(db, booking), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
