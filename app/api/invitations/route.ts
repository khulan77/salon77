import { tenant } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import {
  createInvitation,
  cancelInvitation,
  recordId,
} from "@/lib/services/team";
import { HttpError } from "@/lib/errors";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await tenant());
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_DEVELOPMENT_INVITE_LINKS !== "true"
    )
      throw new HttpError(
        503,
        "Имэйл илгээлт тохируулагдаагүй байна. Админ туршилтын холбоосын горимыг идэвхжүүлэх шаардлагатай.",
      );
    const result = await createInvitation(db, actor, await request.json());
    return Response.json(
      {
        id: result.id,
        invitePath: `/invite?token=${result.token}`,
        message:
          "Урилга үүслээ. Туршилтын горим: имэйл илгээгээгүй. Холбоосыг зөвхөн уригдсан хүнд дамжуулна уу.",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await tenant());
    const id = recordId.parse(new URL(request.url).searchParams.get("id"));
    await cancelInvitation(db, actor, id);
    return Response.json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
