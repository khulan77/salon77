import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import {
  readBookingSettings,
  saveBookingSettings,
} from "@/lib/services/booking-settings";
export async function GET() {
  try {
    return Response.json(
      await readBookingSettings(db, actorFromMember(await membership())),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    return Response.json(
      await saveBookingSettings(
        db,
        actorFromMember(await membership()),
        await request.json(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
