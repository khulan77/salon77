import { platformAdmin } from "@/lib/auth";
import { failure, sameOrigin } from "@/lib/http";
import { announce } from "@/lib/announce";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await platformAdmin();
    return Response.json(await announce(user.id, await request.json()));
  } catch (e) {
    return failure(e);
  }
}
