import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { adjustStock } from "@/lib/services/inventory";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return Response.json(
      await adjustStock(
        db,
        actorFromMember(await membership()),
        await request.json(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
