import { redirect } from "next/navigation";
import { billingState, type BillingState } from "./billing";
import { cache } from "react";
import { configured } from "./env";
import {
  membership,
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
  setup: { services: boolean; staff: boolean; hours: boolean };
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
export const adminData = cache(async (): Promise<AdminData> => {
  if (!configured)
    return {
      preview: true,
      setup: { services: false, staff: false, hours: false },
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
      members: [],
      invitations: [],
    };
  let member;
  try {
    member = await membership();
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/sign-in");
    if (e instanceof HttpError && e.message === noSalonAccess)
      redirect("/onboarding");
    if (e instanceof HttpError && e.message === salonUnapproved)
      redirect("/onboarding/review");
    if (e instanceof HttpError && e.message === salonSuspended)
      redirect("/suspended");
    if (e instanceof HttpError && e.message === salonUnpaid)
      redirect("/billing");
    throw e;
  }
  const actor = actorFromMember(member);
  const [branches, members, invitations] = await Promise.all([
    db.branch.findMany({
      where: branchWhere(actor),
      orderBy: { createdAt: "asc" },
    }),
    actor.role === "SALON_OWNER"
      ? db.salonMember.findMany({
          where: { salonId: member.salonId },
          include: { user: true, branches: { include: { branch: true } } },
        })
      : Promise.resolve([]),
    actor.role === "SALON_OWNER"
      ? db.invitation.findMany({
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
        })
      : Promise.resolve([]),
  ]);
  const setup =
    actor.role === "SALON_OWNER"
      ? await setupProgress(db, actor.salonId)
      : { services: false, staff: false, hours: false };
  const billing = billingState(member.salon);
  return {
    preview: false,
    setup,
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
});
