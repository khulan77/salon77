export type Membership = {
  salonId: string;
  active: boolean;
  role: string;
  branches: { branchId: string }[];
};
export function permits(
  member: Membership | null,
  salonId: string,
  operation: "read" | "manage",
  branchId?: string,
) {
  if (!member || !member.active || member.salonId !== salonId) return false;
  if (member.role === "SALON_OWNER") return true;
  if (
    operation === "manage" ||
    !["MANAGER", "RECEPTIONIST", "STAFF"].includes(member.role)
  )
    return false;
  return Boolean(
    branchId && member.branches.some((b) => b.branchId === branchId),
  );
}
