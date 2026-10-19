import { redirect } from "next/navigation";
import { billingState, type BillingState } from "./billing";
import { cache } from "react";
import { configured } from "./env";
import {
  membership,
  sessionUser,
  isPlatformOperator,
  HttpError,
  noSalonAccess,
  salonSuspended,
  salonUnapproved,
  salonUnpaid,
} from "./auth";
import { actorFromMember, branchWhere } from "./access";
import { invitationStatus } from "./services/team";
import { db } from "./db";
import { setupProgress } from "./services/staff";
import { unseenNotices } from "./services/notices";
export type BranchView = {
  id: string;
  name: string;
  district: string;
  address: string;
  phone: string;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  openMinute: number;
  closeMinute: number;
  imageUrl: string | null;
};
export type AdminData = {
  preview: boolean;
  role: string;
  memberId: string;
  // Trial or paid access; `warn` is true in the last days before it ends.
  billing: { state: BillingState; daysLeft: number; warn: boolean };
  salonName: string;
  salonId: string;
  // Uploaded in Settings; the sidebar shows scissors without one.
  logoUrl: string | null;
  slug: string;
  name: string;
  email: string;
  branches: BranchView[];
  // Platform announcements this member has not dismissed.
  notices: { id: string; title: string; message: string; createdAt: string }[];
};
// Only the team and staff pages need the member and invitation lists, and only
// the calendar the setup checklist, so the shared layout does not load them.
export type TeamData = AdminData & {
  members: {
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
    branchIds: string[];
    branches: string[];
    lastLoginAt: string | null;
  }[];
  invitations: {
    id: string;
    name: string;
    email: string;
    role: string;
    expiresAt: string;
    status: string;
    branchIds: string[];
  }[];
};
export type SetupData = AdminData & {
  setup: { services: boolean; staff: boolean; hours: boolean };
};
const previewData: AdminData = {
  preview: true,
  billing: { state: "FREE", daysLeft: 0, warn: false },
  role: "SALON_OWNER",
  memberId: "",
  salonName: "Таны салон",
  salonId: "",
  logoUrl: null,
  slug: "",
  name: "Салоны эзэн",
  email: "Танилцах горим",
  branches: [],
  notices: [],
};
// The signed-in member, once per request; anyone without admin access is sent
// where they belong.
export const adminMember = cache(async () => {
  try {
    // Pending salons get in too; moduleAllowed keeps them to the setup pages.
    return await membership({ unapproved: true });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/sign-in");
    if (e instanceof HttpError && e.message === noSalonAccess) {
      const user = await sessionUser().catch(() => null);
      redirect(
        user && (await isPlatformOperator(user.id))
          ? "/platform"
          : "/onboarding",
      );
    }
    if (e instanceof HttpError && e.message === salonUnapproved)
      redirect("/onboarding/review");
    if (e instanceof HttpError && e.message === salonSuspended)
      redirect("/suspended");
    if (e instanceof HttpError && e.message === salonUnpaid)
      redirect("/billing");
    throw e;
  }
});
export async function adminActor() {
  return configured ? actorFromMember(await adminMember()) : null;
}
export const adminData = cache(async (): Promise<AdminData> => {
  if (!configured) return previewData;
  const member = await adminMember();
  const [branches, notices] = await Promise.all([
    db.branch.findMany({
      where: branchWhere(actorFromMember(member)),
      orderBy: { createdAt: "asc" },
    }),
    unseenNotices(db, member),
  ]);
  const billing = billingState(member.salon);
  return {
    preview: false,
    billing: {
      state: billing.state,
      daysLeft: billing.daysLeft,
      warn: billing.warn,
    },
    role: member.role,
    memberId: member.id,
    salonName: member.salon.name,
    salonId: member.salonId,
    logoUrl: member.salon.logoUrl,
    slug: member.salon.slug,
    name: member.user.name ?? "Салоны эзэн",
    email: member.user.email,
    branches,
    notices,
  };
});
export async function teamLists(): Promise<
  Pick<TeamData, "members" | "invitations">
> {
  const member = configured ? await adminMember() : null;
  if (member?.role !== "SALON_OWNER") return { members: [], invitations: [] };
  const [members, invitations] = await Promise.all([
    db.salonMember.findMany({
      where: { salonId: member.salonId },
      include: { user: true, branches: { include: { branch: true } } },
    }),
    db.invitation.findMany({
      where: { salonId: member.salonId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        expiresAt: true,
        status: true,
        branches: { select: { branchId: true } },
      },
    }),
  ]);
  return {
    members: members.map((m) => ({
      id: m.id,
      name: m.user.name ?? "Гишүүн",
      email: m.user.email,
      role: m.role,
      active: m.active,
      branchIds: m.branches.map((b) => b.branchId),
      branches: m.branches.map((b) => b.branch.name),
      lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
    })),
    invitations: invitations.map((i) => ({
      ...i,
      status: invitationStatus(i),
      branchIds: i.branches.map((b) => b.branchId),
      expiresAt: i.expiresAt.toISOString(),
    })),
  };
}
export async function setupState(): Promise<SetupData["setup"]> {
  const member = configured ? await adminMember() : null;
  return member?.role === "SALON_OWNER"
    ? setupProgress(db, member.salonId)
    : { services: false, staff: false, hours: false };
}
