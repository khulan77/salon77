import { redirect } from "next/navigation";
import { cache } from "react";
import { configured } from "./env";
import { tenant, HttpError } from "./auth";
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
    branches: string[];
  }[];
  invitations: {
    id: string;
    name: string;
    email: string;
    role: string;
    expiresAt: string;
  }[];
};
export const adminData = cache(async (): Promise<AdminData> => {
  if (!configured)
    return {
      preview: true,
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
    member = await tenant();
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/sign-in");
    if (
      e instanceof HttpError &&
      e.message === "Салонд хандах идэвхтэй эрх алга."
    )
      redirect("/onboarding");
    throw e;
  }
  const [branches, members, invitations] = await Promise.all([
    db.branch.findMany({
      where: { salonId: member.salonId },
      orderBy: { createdAt: "asc" },
    }),
    db.salonMember.findMany({
      where: { salonId: member.salonId, active: true },
      include: { user: true, branches: { include: { branch: true } } },
    }),
    db.invitation.findMany({
      where: { salonId: member.salonId, acceptedAt: null, revokedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        expiresAt: true,
      },
    }),
  ]);
  return {
    preview: false,
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
      branches: m.branches.map((b) => b.branch.name),
    })),
    invitations: invitations.map((i) => ({
      ...i,
      expiresAt: i.expiresAt.toISOString(),
    })),
  };
});
