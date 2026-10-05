import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import {
  readSchedules,
  saveTimeOff,
  removeSchedule,
} from "@/lib/services/staff";
import { recordId } from "@/lib/services/team";
export async function GET(request: Request) {
  try {
    return Response.json(
      await readSchedules(
        db,
        actorFromMember(await membership()),
        new URL(request.url).searchParams.get("branchId") ?? undefined,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
async function save(request: Request, editing: boolean) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await membership());
    const id = editing
      ? recordId.parse(new URL(request.url).searchParams.get("id"))
      : undefined;
    return Response.json(
      await saveTimeOff(db, actor, await request.json(), id),
      { status: editing ? 200 : 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  return save(request, false);
}
export async function PATCH(request: Request) {
  return save(request, true);
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    return Response.json(
      await removeSchedule(
        db,
        actorFromMember(await membership()),
        "timeOff",
        recordId.parse(new URL(request.url).searchParams.get("id")),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
