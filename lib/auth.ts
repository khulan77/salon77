import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "./db";
import { supabase } from "./supabase";
import { configured } from "./env";
import { permits } from "./permissions";
import { HttpError } from "./errors";
import { billingState } from "./billing";
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
export const noSalonAccess = "Салонд хандах идэвхтэй эрх алга.";
export const salonSuspended = "Салон тань түр хаагдсан байна.";
export const salonUnpaid = "Салоны төлбөрийн хугацаа дууссан байна.";
export const salonUnapproved =
  "Салон тань баталгаажсаны дараа энэ хэсэг нээгдэнэ.";
// Until the platform approves the salon, only its application is reachable;
// once its trial or paid month runs out, only the billing page. The options
// open those two paths.
export async function membership({ unapproved = false, unpaid = false } = {}) {
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
  if (!member) throw new HttpError(403, noSalonAccess);
  if (member.salon.status !== "ACTIVE")
    throw new HttpError(403, salonSuspended);
  if (!unapproved && member.salon.reviewStatus !== "APPROVED")
    throw new HttpError(403, salonUnapproved);
  if (!unpaid && billingState(member.salon).state === "EXPIRED")
    throw new HttpError(402, salonUnpaid);
  return member;
}
export async function tenant() {
  const member = await membership();
  if (!permits(member, member.salonId, "manage"))
    throw new HttpError(403, "Зөвхөн эзэмшигч хандах эрхтэй.");
  return member;
}
// Platform console: a verified session whose User row is a super admin.
// Anything else looks like a missing page.
export async function platformAdminId(): Promise<string> {
  if (!configured) notFound();
  const user = await identity().catch(() => null);
  if (!user) notFound();
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { isSuperAdmin: true },
  });
  if (!row?.isSuperAdmin) notFound();
  return user.id;
}
