import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { readInventory, saveProduct } from "@/lib/services/inventory";
import { recordId } from "@/lib/services/team";
export async function GET() {
  try {
    return Response.json(
      await readInventory(db, actorFromMember(await membership())),
      { headers: { "Cache-Control": "no-store" } },
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
      await saveProduct(db, actor, await request.json(), id),
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
