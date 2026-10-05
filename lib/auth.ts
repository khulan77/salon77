import { cookies } from "next/headers";
import { db } from "./db";
import { supabase } from "./supabase";
import { configured } from "./env";
import { permits } from "./permissions";
import { HttpError } from "./errors";
export { HttpError } from "./errors";
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
export async function membership() {
  const user = await identity();
  const selected = (await cookies()).get("salon77-tenant")?.value;
  const member = await db.salonMember.findFirst({
    where: {
      userId: user.id,
      active: true,
      ...(selected ? { salonId: selected } : {}),
    },
    include: {
      salon: true,
      branches: { where: { branch: { active: true } } },
      user: true,
      staff: { include: { branches: { where: { branch: { active: true } } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!member || member.salon.status !== "ACTIVE")
    throw new HttpError(403, "Салонд хандах идэвхтэй эрх алга.");
  return member;
}
export async function tenant() {
  const member = await membership();
  if (!permits(member, member.salonId, "manage"))
    throw new HttpError(403, "Зөвхөн эзэмшигч хандах эрхтэй.");
  return member;
}
