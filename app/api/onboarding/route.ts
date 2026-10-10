import { cookies } from "next/headers";
import { identity, membership, HttpError } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { resubmitApplication } from "@/lib/services/application";
import { db } from "@/lib/db";
import { onboardingSchema } from "@/lib/validation";
import { failure, sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    const { branch, ...data } = onboardingSchema.parse(await request.json());
    const salon = await db.$transaction(
      async (tx) => {
        await tx.user.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            email: user.email!,
            lastLoginAt: new Date(),
            name:
              typeof user.user_metadata.name === "string"
                ? user.user_metadata.name
                : null,
          },
          update: { email: user.email! },
        });
        if (await tx.salonMember.findFirst({ where: { userId: user.id } }))
          throw new HttpError(409, "Та аль хэдийн салоны гишүүн болсон байна.");
        // Every new salon waits for the platform's review before it is public.
        return tx.salon.create({
          data: {
            ...data,
            instagram: data.instagram || null,
            facebook: data.facebook || null,
            reviewStatus: "PENDING",
            submittedAt: new Date(),
            email: user.email,
            branches: { create: branch },
            members: { create: { userId: user.id, role: "SALON_OWNER" } },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    (await cookies()).set("salon77-tenant", salon.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return Response.json({ success: true }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const member = await membership();
    return Response.json(
      await resubmitApplication(
        db,
        actorFromMember(member),
        await request.json(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function GET(request: Request) {
  try {
    await identity();
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    const valid = onboardingSchema.shape.slug.safeParse(slug);
    return Response.json({
      available:
        valid.success &&
        !(await db.salon.findUnique({ where: { slug }, select: { id: true } })),
    });
  } catch (e) {
    return failure(e);
  }
}
