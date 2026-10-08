import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { readTimesheet, setAttendance } from "@/lib/services/timesheet";
export async function GET(request: Request) {
  try {
    return Response.json(
      await readTimesheet(
        db,
        actorFromMember(await membership()),
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    return Response.json(
      await setAttendance(
        db,
        actorFromMember(await membership()),
        await request.json(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
