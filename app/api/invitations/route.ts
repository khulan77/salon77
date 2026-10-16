import { tenant } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { db } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import {
  createInvitation,
  cancelInvitation,
  recordId,
} from "@/lib/services/team";
import { sendInvitationEmail } from "@/lib/notifications/platform-email";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await tenant());
    const result = await createInvitation(db, actor, await request.json());
    const invitePath = `/invite?token=${result.token}`;
    const origin =
      process.env.APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const emailed = await sendInvitationEmail(result.email, {
      name: result.name,
      salonName: result.salonName,
      branchName: result.branchName,
      link: `${origin}${invitePath}`,
      expiresAt: result.expiresAt,
    });
    return Response.json(
      {
        id: result.id,
        invitePath,
        emailed,
        replaced: result.replaced,
        expiresAt: result.expiresAt.toISOString(),
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
