import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "./db";
import { supabase } from "./supabase";
import { configured } from "./env";
import { permits } from "./permissions";
import { HttpError } from "./errors";
import { billingState } from "./billing";
import { platformEmailAllowed, platformMfaFresh } from "./platform-access";
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
export const sessionUser = cache(async () => {
  if (!configured) return identity();
  const { data } = await (await supabase()).auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || typeof claims.email !== "string" || !claims.email)
    throw new HttpError(401, "Нэвтэрнэ үү.");
  return { id: claims.sub, email: claims.email };
});


const sessionMember = cache(async () => {
  const user = await sessionUser();
  const selected = (await cookies()).get("salon77-tenant")?.value;
  return db.salonMember.findFirst({
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
});
export const noSalonAccess = "Салонд хандах идэвхтэй эрх алга.";
export const salonSuspended = "Салон тань түр хаагдсан байна.";
export const salonUnpaid = "Салоны төлбөрийн хугацаа дууссан байна.";
export const salonUnapproved =
  "Салон тань баталгаажсаны дараа энэ хэсэг нээгдэнэ.";

  
export async function membership({ unapproved = false, unpaid = false } = {}) {
  const member = await sessionMember();
  if (!member) throw new HttpError(403, noSalonAccess);
  if (member.salon.status !== "ACTIVE")
    throw new HttpError(403, salonSuspended);
  if (!unapproved && member.salon.reviewStatus !== "APPROVED")
    throw new HttpError(403, salonUnapproved);
  if (!unpaid && billingState(member.salon).state === "EXPIRED")
    throw new HttpError(402, salonUnpaid);
  return member;
}
// Setting up a salon (services, staff, hours, branches, photos) works before
// approval, so the owner can prepare and preview while the platform reviews.
export const setupAccess = { unapproved: true } as const;
export async function tenant(options: Parameters<typeof membership>[0] = {}) {
  const member = await membership(options);
  if (!permits(member, member.salonId, "manage"))
    throw new HttpError(403, "Зөвхөн эзэмшигч хандах эрхтэй.");
  return member;
}
// Whether a user is the platform operator; an operator without a salon of
// their own belongs on the console, not in salon onboarding.
export async function isPlatformOperator(userId: string) {
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  return Boolean(row?.isSuperAdmin);
}
// Platform console: a session confirmed with the Auth server, an allowed
// email, a super-admin User row and a fresh authenticator code. `verified`
// is false while only the code is missing.
export const platformSession = cache(async () => {
  if (!configured) return null;
  const client = await supabase();
  const [{ data: user }, { data: claims }] = await Promise.all([
    client.auth.getUser(),
    client.auth.getClaims(),
  ]);
  const email = user.user?.email;
  if (!user.user || !email || claims?.claims.sub !== user.user.id) return null;
  if (!platformEmailAllowed(email)) return null;
  if (!(await isPlatformOperator(user.user.id))) return null;
  return {
    id: user.user.id,
    email,
    verified: platformMfaFresh(claims.claims),
  };
});
// Anything short of an operator looks like a missing page.
export async function platformAdminId(): Promise<string> {
  const session = await platformSession();
  if (!session) notFound();
  if (!session.verified) redirect("/platform-verify");
  return session.id;
}
// The same rules for the console's API routes.
export async function platformAdmin() {
  const session = await platformSession();
  if (!session?.verified) throw new HttpError(404, "Хуудас олдсонгүй.");
  return session;
}
