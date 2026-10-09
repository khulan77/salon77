import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { guardPublic } from "@/lib/rate-limit";
import { deliverSoon } from "@/lib/notifications/schedule";
import {
  changeManagedVisit,
  managedAvailability,
  readManagedVisit,
} from "@/lib/services/manage";
type Params = { params: Promise<{ slug: string }> };
// GET ?token&date: open times for moving the visit.
export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    await guardPublic(db, request, slug, "availability");
    const q = new URL(request.url).searchParams;
    return Response.json(
      await managedAvailability(db, slug, {
        token: q.get("token"),
        date: q.get("date"),
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
// POST { action: "cancel" | "reschedule", token, startAt? }
export async function POST(request: Request, { params }: Params) {
  try {
    sameOrigin(request);
    const { slug } = await params;
    await guardPublic(db, request, slug, "booking");
    const body = await request.json();
    await changeManagedVisit(db, slug, body);
    deliverSoon();
    return Response.json(await readManagedVisit(db, slug, body.token), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
