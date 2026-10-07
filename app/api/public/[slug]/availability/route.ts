import { db } from "@/lib/db";
import { failure } from "@/lib/http";
import { availability } from "@/lib/services/bookings";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    return Response.json(
      await availability(
        db,
        { slug: (await params).slug },
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
