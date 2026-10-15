import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { guardPublic } from "@/lib/rate-limit";
import { readManagedVisit } from "@/lib/services/manage";
import { submitReview } from "@/lib/services/reviews";
type Params = { params: Promise<{ slug: string }> };
// POST { token, rating, comment }: a guest rates their finished visit.
export async function POST(request: Request, { params }: Params) {
  try {
    sameOrigin(request);
    const { slug } = await params;
    await guardPublic(db, request, slug, "booking");
    const body = await request.json();
    await submitReview(db, slug, body);
    return Response.json(await readManagedVisit(db, slug, body.token), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
