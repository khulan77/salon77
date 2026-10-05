import { tenant, membership, HttpError } from "@/lib/auth";
import { actorFromMember, branchWhere, requireBranch } from "@/lib/access";
import { db } from "@/lib/db";
import { branchSchema } from "@/lib/validation";
import { failure, sameOrigin } from "@/lib/http";
export async function GET(request: Request) {
  try {
    const actor = actorFromMember(await membership());
    const branchId = new URL(request.url).searchParams.get("branchId");
    if (branchId) requireBranch(actor, branchId);
    return Response.json(
      await db.branch.findMany({
        where: { ...branchWhere(actor), ...(branchId ? { id: branchId } : {}) },
        orderBy: { createdAt: "asc" },
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const member = await tenant();
    const data = branchSchema.parse(await request.json());
    return Response.json(
      await db.branch.create({ data: { ...data, salonId: member.salonId } }),
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const member = await tenant();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new HttpError(400, "Салбараа сонгоно уу.");
    const data = branchSchema.parse(await request.json());
    const result = await db.branch.updateMany({
      where: { id, salonId: member.salonId },
      data,
    });
    if (!result.count) throw new HttpError(404, "Салбар олдсонгүй.");
    return Response.json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
