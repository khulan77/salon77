import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import {
  createVisit,
  visitAvailability,
  visitReceipt,
  managePath,
} from "@/lib/services/visits";
import { guardPublic } from "@/lib/rate-limit";
import { deliverSoon } from "@/lib/notifications/schedule";
type Params = { params: Promise<{ slug: string }> };
// GET ?branchId&date&services=a,b&staff=x, — empty staff means anyone.
export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    await guardPublic(db, request, slug, "availability");
    const q = new URL(request.url).searchParams;
    const services = (q.get("services") ?? "").split(",").filter(Boolean),
      staff = (q.get("staff") ?? "").split(",");
    return Response.json(
      await visitAvailability(db, slug, {
        branchId: q.get("branchId") ?? "",
        date: q.get("date") ?? "",
        items: services.map((serviceId, i) => ({
          serviceId,
          ...(staff[i] ? { staffId: staff[i] } : {}),
        })),
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, { params }: Params) {
  try {
    sameOrigin(request);
    const { slug } = await params;
    await guardPublic(db, request, slug, "booking");
    const bookings = await createVisit(db, slug, await request.json());
    deliverSoon();
    return Response.json(
      {
        ...(await visitReceipt(db, bookings)),
        manageUrl: bookings.manageToken
          ? managePath(slug, bookings.manageToken)
          : null,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
