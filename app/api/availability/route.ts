import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure } from "@/lib/http";
import { availability } from "@/lib/services/bookings";
export async function GET(request: Request) {
  try {
    return Response.json(
      await availability(
        db,
        { actor: actorFromMember(await membership()) },
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
