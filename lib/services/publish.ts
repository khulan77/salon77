import type { Prisma } from "@prisma/client";
type Database = Prisma.TransactionClient;
// What a salon's profile needs before the directory lists its booking page:
// a picture, a priced bookable service, staff with hours and an address.
const pricedService: Prisma.ServiceWhereInput = {
  active: true,
  onlineBookable: true,
  priceMnt: { gt: 0 },
  category: { active: true },
  branches: { some: { branch: { active: true } } },
};
const workingStaff: Prisma.StaffWhereInput = {
  active: true,
  branches: {
    some: {
      branch: { active: true },
      hours: { some: { active: true } },
    },
  },
};
// A branch photo (its gallery's first photo) counts as the salon's picture.
const photographedBranch: Prisma.BranchWhereInput = {
  active: true,
  imageUrl: { not: null },
};
const addressedBranch: Prisma.BranchWhereInput = {
  active: true,
  address: { not: "" },
};
export const profileReady: Prisma.SalonWhereInput = {
  AND: [
    {
      OR: [
        { logoUrl: { not: null } },
        { coverUrl: { not: null } },
        { branches: { some: photographedBranch } },
      ],
    },
    { services: { some: pricedService } },
    { staff: { some: workingStaff } },
    { branches: { some: addressedBranch } },
  ],
};
export const PROFILE_ITEMS = [
  {
    key: "picture",
    label: "Лого, нүүр зураг эсвэл салбарын зураг",
    href: "/settings",
  },
  {
    key: "service",
    label: "Үнэтэй, онлайнаар захиалах үйлчилгээ",
    href: "/services",
  },
  { key: "staff", label: "Ажилтан", href: "/employees" },
  { key: "hours", label: "Ажилтны ажлын цаг", href: "/employees" },
  { key: "address", label: "Салбарын хаяг", href: "/branches" },
] as const;
export type ProfileItem = (typeof PROFILE_ITEMS)[number] & { done: boolean };
// Each item with whether it is done, for the owner's checklist and the
// platform's review page.
export async function profileChecklist(
  db: Database,
  salonId: string,
): Promise<ProfileItem[]> {
  const [salon, service, staff, hours, address, photos] = await Promise.all([
    db.salon.findUnique({
      where: { id: salonId },
      select: { logoUrl: true, coverUrl: true },
    }),
    db.service.count({ where: { salonId, ...pricedService } }),
    db.staff.count({ where: { salonId, active: true } }),
    db.staff.count({ where: { salonId, ...workingStaff } }),
    db.branch.count({ where: { salonId, ...addressedBranch } }),
    db.branch.count({ where: { salonId, ...photographedBranch } }),
  ]);
  const done: Record<string, boolean> = {
    picture: Boolean(salon?.logoUrl || salon?.coverUrl || photos > 0),
    service: service > 0,
    staff: staff > 0,
    hours: hours > 0,
    address: address > 0,
  };
  return PROFILE_ITEMS.map((item) => ({ ...item, done: done[item.key] }));
}
