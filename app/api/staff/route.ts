import { membership, tenant } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { readStaff, saveStaff } from "@/lib/services/staff";
import { recordId } from "@/lib/services/team";
export async function GET(request: Request) {
  try {
    return Response.json(
      await readStaff(
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
    const actor = actorFromMember(await tenant());
    const id = editing
      ? recordId.parse(new URL(request.url).searchParams.get("id"))
      : undefined;
    return Response.json(await saveStaff(db, actor, await request.json(), id), {
      status: editing ? 200 : 201,
    });
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
