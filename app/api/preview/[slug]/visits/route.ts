import { db } from "@/lib/db";
import { membership, setupAccess } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure } from "@/lib/http";
import { HttpError } from "@/lib/errors";
import { previewVisitAvailability } from "@/lib/services/visits";
// Free times for the salon's own team while its booking page is in preview.
// GET ?branchId&date&services=a,b&staff=x, — the same query as the public one.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const q = new URL(request.url).searchParams;
    const services = (q.get("services") ?? "").split(",").filter(Boolean),
      staff = (q.get("staff") ?? "").split(",");
    return Response.json(
      await previewVisitAvailability(
        db,
        // Someone outside the salon learns nothing about it.
        actorFromMember(
          await membership(setupAccess).catch(() => {
            throw new HttpError(404, "Салон олдсонгүй.");
          }),
        ),
        slug,
        {
          branchId: q.get("branchId") ?? "",
          date: q.get("date") ?? "",
          items: services.map((serviceId, i) => ({
            serviceId,
            ...(staff[i] ? { staffId: staff[i] } : {}),
          })),
        },
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
