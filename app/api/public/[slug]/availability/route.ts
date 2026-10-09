import { db } from "@/lib/db";
import { failure } from "@/lib/http";
import { availability } from "@/lib/services/bookings";
import { guardPublic } from "@/lib/rate-limit";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    await guardPublic(db, request, slug, "availability");
    return Response.json(
      await availability(
        db,
        { slug },
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
