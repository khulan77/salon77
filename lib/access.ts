import { HttpError } from "./errors";
import type { Prisma } from "@prisma/client";
export type Actor = {
  id: string;
  userId: string;
  salonId: string;
  role: string;
  branchIds: string[];
  staffId?: string;
};
export function requireOwner(actor: Actor) {
  if (actor.role !== "SALON_OWNER")
    throw new HttpError(403, "Зөвхөн эзэмшигч хандах эрхтэй.");
}
export function canAccessBranch(actor: Actor, branchId: string) {
  return (
    actor.role === "SALON_OWNER" ||
    (["MANAGER", "RECEPTIONIST", "STAFF"].includes(actor.role) &&
      actor.branchIds.includes(branchId))
  );
}
// The front desk manages staff and services that belong only to its own
// branches; anything shared with another branch stays with the admin.
export function ownsBranches(actor: Actor, branchIds: string[]) {
  return (
    actor.role === "SALON_OWNER" ||
    (actor.role === "RECEPTIONIST" &&
      branchIds.length > 0 &&
      branchIds.every((id) => actor.branchIds.includes(id)))
  );
}
export function requireOwnBranches(actor: Actor, branchIds: string[]) {
  if (!ownsBranches(actor, branchIds))
    throw new HttpError(
      403,
      "Зөвхөн өөрийн салбарын ажилтан, үйлчилгээг удирдах боломжтой.",
    );
}
export function requireBranch(actor: Actor, branchId: string, write = false) {
  if (
    !canAccessBranch(actor, branchId) ||
    (write && !["SALON_OWNER", "MANAGER"].includes(actor.role))
  )
    throw new HttpError(403, "Сонгосон салбарт хандах эрхгүй байна.");
}
export function branchWhere(actor: Actor): Prisma.BranchWhereInput {
  return {
    salonId: actor.salonId,
    ...(actor.role === "SALON_OWNER"
      ? {}
      : { id: { in: actor.branchIds }, active: true }),
  };
}
export function actorFromMember(member: {
  id: string;
  userId: string;
  salonId: string;
  role: string;
  branches: { branchId: string }[];
  staff?: {
    id: string;
    active: boolean;
    branches: { branchId: string }[];
  } | null;
}): Actor {
  return {
    id: member.id,
    userId: member.userId,
    salonId: member.salonId,
    role: member.role,
    branchIds: member.branches
      .map((b) => b.branchId)
      .filter(
        (id) =>
          member.role !== "STAFF" ||
          (member.staff?.active &&
            member.staff.branches.some((b) => b.branchId === id)),
      ),
    staffId: member.staff?.active ? member.staff.id : undefined,
  };
}
export async function assertActiveBranches(
  tx: Prisma.TransactionClient,
  actor: Actor,
  ids: string[],
) {
  if (
    ids.some((id) => !canAccessBranch(actor, id)) ||
    (await tx.branch.count({
      where: { id: { in: ids }, salonId: actor.salonId, active: true },
    })) !== ids.length
  )
    throw new HttpError(403, "Сонгосон салбарт хандах эрхгүй байна.");
}
export async function refreshActor(
  tx: Prisma.TransactionClient,
  actor: Actor,
): Promise<Actor> {
  const member = await tx.salonMember.findFirst({
    where: {
      id: actor.id,
      userId: actor.userId,
      salonId: actor.salonId,
      active: true,
      salon: { status: "ACTIVE" },
    },
    include: {
      branches: { where: { branch: { active: true } } },
      staff: { include: { branches: { where: { branch: { active: true } } } } },
    },
  });
  if (!member) throw new HttpError(403, "Салонд хандах идэвхтэй эрх алга.");
  return actorFromMember(member);
}
// Before the platform approves a salon its team can only set it up.
export const setupModules = [
  "/services",
  "/employees",
  "/schedules",
  "/branches",
  "/settings",
  "/support",
];
export function moduleAllowed(role: string, module: string, approved = true) {
  if (!approved && !setupModules.includes(module)) return false;
  if (role === "SALON_OWNER") return true;
  const permitted: Record<string, string[]> = {
    MANAGER: [
      "/",
      "/reports",
      "/reviews",
      "/branches",
      "/services",
      "/employees",
      "/schedules",
      "/timesheet",
      "/calendar",
      "/bookings",
      "/customers",
      "/inventory",
      "/support",
    ],
    // Front desk: bookings, customers, staff and services of their own
    // branch. Reports, settings, team and billing stay with the admin.
    RECEPTIONIST: [
      "/",
      "/calendar",
      "/bookings",
      "/customers",
      "/services",
      "/employees",
      "/schedules",
      "/timesheet",
      "/inventory",
      "/support",
    ],
    STAFF: ["/", "/services", "/schedules", "/support"],
  };
  return permitted[role]?.includes(module) ?? false;
}
