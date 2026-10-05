import { cookies } from "next/headers";
import { z } from "zod";
import { identity } from "@/lib/auth";
import { db } from "@/lib/db";
import { tokenSchema } from "@/lib/validation";
import { inspectInvitation, acceptInvitation } from "@/lib/services/team";
import { failure, sameOrigin } from "@/lib/http";
import { roleHome } from "@/lib/auth-navigation";
export async function GET(request: Request) {
  try {
    const user = await identity();
    const token = tokenSchema.parse(
      new URL(request.url).searchParams.get("token"),
    );
    return Response.json(
      await inspectInvitation(
        db,
        {
          id: user.id,
          email: user.email!,
          emailConfirmed: Boolean(user.email_confirmed_at),
        },
        token,
      ),
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    const { token } = z
      .object({ token: tokenSchema })
      .strict()
      .parse(await request.json());
    const result = await acceptInvitation(
      db,
      {
        id: user.id,
        email: user.email!,
        emailConfirmed: Boolean(user.email_confirmed_at),
      },
      token,
    );
    (await cookies()).set("salon77-tenant", result.salonId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return Response.json(
      { redirectTo: roleHome(result.role) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
