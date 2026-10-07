import type { PrismaClient } from "@prisma/client";
import { actorFromMember } from "../../lib/access";
export async function bookingSeed(db: PrismaClient) {
  for (const [salonId, branchId] of [
    ["a", "z"],
    ["b", "other"],
  ]) {
    await db.serviceCategory.create({
      data: {
        id: `book-category-${salonId}`,
        salonId,
        name: "Захиалгын ангилал",
      },
    });
    for (const duration of [90, 60])
      await db.service.create({
        data: {
          id: `book-service-${salonId}-${duration}`,
          salonId,
          categoryId: `book-category-${salonId}`,
          name: duration === 90 ? "Гел маникюр" : "Хумс арчилгаа",
          durationMinutes: duration,
          priceMnt: 65000,
          onlineBookable: true,
          branches: { create: { branchId } },
        },
      });
    for (const i of [1, 2]) {
      const staff = await db.staff.create({
        data: {
          id: `book-staff-${salonId}-${i}`,
          salonId,
          name: i === 1 ? "Ану" : "Болор",
          title: "Мастер",
          phone: "99112233",
          bio: "Хувийн мэдээлэл",
          branches: { create: { branchId } },
          services: {
            create: [90, 60].map((duration) => ({
              serviceId: `book-service-${salonId}-${duration}`,
            })),
          },
        },
      });
      for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++)
        await db.workingHours.create({
          data: {
            salonId,
            staffId: staff.id,
            branchId,
            dayOfWeek,
            startMinute: 600,
            endMinute: 1080,
            breaks: { create: { startMinute: 780, endMinute: 840 } },
          },
        });
    }
  }
  const actor = async (id: string) =>
    actorFromMember(
      await db.salonMember.findUniqueOrThrow({
        where: { id },
        include: { branches: true, staff: { include: { branches: true } } },
      }),
    );
  return {
    owner: await actor("owner"),
    other: await actor("other"),
    reception: await actor("reception"),
    manager: await actor("manager"),
    staff: await actor("staff"),
  };
}
