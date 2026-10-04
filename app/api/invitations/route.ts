import { createHash, randomBytes } from "node:crypto";
import { tenant, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { inviteSchema } from "@/lib/validation";
import { failure, sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const member = await tenant();
    const input = inviteSchema.parse(await request.json());
    const ids = [...new Set(input.branchIds)];
    const result = await db.$transaction(async (tx) => {
      const count = await tx.branch.count({
        where: { id: { in: ids }, salonId: member.salonId, active: true },
      });
      if (count !== ids.length)
        throw new HttpError(
          400,
          "Өөрийн салоны идэвхтэй салбаруудаас сонгоно уу.",
        );
      // Persist only a token hash. Delivery and verified-email acceptance ship together later.
      const tokenHash = createHash("sha256")
        .update(randomBytes(32))
        .digest("hex");
      return tx.invitation.create({
        data: {
          salonId: member.salonId,
          name: input.name,
          email: input.email,
          role: input.role,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 86400000),
          branches: {
            create: ids.map((branchId) => ({
              branchId,
              salonId: member.salonId,
            })),
          },
        },
        select: { id: true },
      });
    });
    return Response.json(
      {
        ...result,
        message:
          "Урилгын нооргийг хадгаллаа. Илгээх боломж хараахан нээгдээгүй байна.",
      },
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
