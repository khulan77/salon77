import { redirect } from "next/navigation";
import { cache } from "react";
import { configured } from "./env";
import { membership, HttpError } from "./auth";
import { actorFromMember, branchWhere } from "./access";
import { invitationStatus } from "./services/team";
import { db } from "./db";
export type BranchView = {
  id: string;
  name: string;
  district: string;
  address: string;
  phone: string;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
};
export type AdminData = {
  preview: boolean;
  role: string;
  memberId: string;
  setup: { services: boolean; staff: boolean; hours: boolean };
  salonName: string;
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
      role: "SALON_OWNER",
      memberId: "",
      salonName: "Таны салон",
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
    if (
      e instanceof HttpError &&
      e.message === "Салонд хандах идэвхтэй эрх алга."
    )
      redirect("/onboarding");
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
      ? await Promise.all([
          db.service.count({
            where: {
              salonId: actor.salonId,
              active: true,
              category: { active: true },
              branches: { some: { branch: { active: true } } },
            },
          }),
          db.staff.count({
            where: {
              salonId: actor.salonId,
              active: true,
              services: { some: { service: { active: true } } },
            },
          }),
          db.workingHours.count({
            where: {
              salonId: actor.salonId,
              active: true,
              assignment: { staff: { active: true }, branch: { active: true } },
            },
          }),
        ])
      : [0, 0, 0];
  return {
    preview: false,
    setup: { services: setup[0] > 0, staff: setup[1] > 0, hours: setup[2] > 0 },
    role: member.role,
    memberId: member.id,
    salonName: member.salon.name,
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
    })),
    invitations: invitations.map((i) => ({
      ...i,
      status: invitationStatus(i),
      branchIds: i.branches.map((b) => b.branchId),
      expiresAt: i.expiresAt.toISOString(),
    })),
  };
});
