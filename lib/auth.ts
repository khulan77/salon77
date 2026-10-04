import { cookies } from "next/headers";
import { db } from "./db";
import { supabase } from "./supabase";
import { configured } from "./env";
import { permits } from "./permissions";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function identity() {
  if (!configured)
    throw new HttpError(
      503,
      "Системийн холболт тохируулагдаагүй байна. Одоогоор танилцах горим ашиглана уу.",
    );
  const {
    data: { user },
  } = await (await supabase()).auth.getUser();
  if (!user || !user.email) throw new HttpError(401, "Нэвтэрнэ үү.");
  return user;
}
export async function tenant() {
  const user = await identity();
  const selected = (await cookies()).get("salon77-tenant")?.value;
  const member = await db.salonMember.findFirst({
    where: {
      userId: user.id,
      active: true,
      ...(selected ? { salonId: selected } : {}),
    },
    include: { salon: true, branches: true, user: true },
    orderBy: { createdAt: "asc" },
  });
  if (!member || member.salon.status !== "ACTIVE")
    throw new HttpError(403, "Салонд хандах идэвхтэй эрх алга.");
  // Non-owner roles are modeled but denied admin access until their scoped modules ship.
  if (!permits(member, member.salonId, "manage"))
    throw new HttpError(403, "Зөвхөн салоны эзэн хандах эрхтэй.");
  return member;
}
