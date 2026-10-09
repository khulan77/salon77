import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import {
  createVisit,
  visitAvailability,
  visitReceipt,
} from "@/lib/services/visits";
type Params = { params: Promise<{ slug: string }> };
// GET ?branchId&date&services=a,b&staff=x, — empty staff means anyone.
export async function GET(request: Request, { params }: Params) {
  try {
    const q = new URL(request.url).searchParams;
    const services = (q.get("services") ?? "").split(",").filter(Boolean),
      staff = (q.get("staff") ?? "").split(",");
    return Response.json(
      await visitAvailability(db, (await params).slug, {
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
    const bookings = await createVisit(
      db,
      (await params).slug,
      await request.json(),
    );
    return Response.json(await visitReceipt(db, bookings), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
