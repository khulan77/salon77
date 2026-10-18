import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "../fixtures/database";
import { actorFromMember } from "../../lib/access";
import { setupProgress, setupSoloOwner } from "../../lib/services/staff";
import {
  previewVisitAvailability,
  visitAvailability,
} from "../../lib/services/visits";
import { readCatalog, saveService } from "../../lib/services/catalog";
import { publicCatalog } from "../../lib/services/bookings";
import { addDays, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
const ownerId = "00000000-0000-0000-0000-0000000000a1",
  helperId = "00000000-0000-0000-0000-0000000000a2",
  otherId = "00000000-0000-0000-0000-0000000000a3";
// A new one-person salon, as onboarding leaves it, plus one service.
async function newSalon(
  db: Awaited<ReturnType<typeof testDatabase>>["db"],
  id: string,
  userId: string,
  services: number,
) {
  await db.salon.create({
    data: {
      id,
      name: "Гоо Нэйлс",
      slug: `goo-neils-${id}`,
      phone: "99112233",
      branches: {
        create: {
          id: `${id}-branch`,
          name: "Төв",
          district: "Хан-Уул",
          address: "Хаяг",
          phone: "99112233",
          openMinute: 600,
          closeMinute: 1140,
        },
      },
      members: {
        create: { id: `${id}-owner`, userId, role: "SALON_OWNER" },
      },
    },
  });
  if (services) {
    await db.serviceCategory.create({
      data: { id: `${id}-category`, salonId: id, name: "Хумс" },
    });
    for (let i = 1; i <= services; i++)
      await db.service.create({
        data: {
          id: `${id}-service-${i}`,
          salonId: id,
          categoryId: `${id}-category`,
          name: `Үйлчилгээ ${i}`,
          durationMinutes: 60,
          priceMnt: 50000,
          onlineBookable: true,
          branches: { create: { branchId: `${id}-branch` } },
        },
      });
  }
  const member = await db.salonMember.findUniqueOrThrow({
    where: { id: `${id}-owner` },
    include: { branches: true, staff: { include: { branches: true } } },
  });
  return actorFromMember(member);
}
// The next Monday–Saturday at least two days ahead, in Ulaanbaatar.
function workday() {
  let day = addDays(localStamp(new Date()).slice(0, 10), 2);
  while (new Date(`${day}T12:00:00Z`).getUTCDay() === 0) day = addDays(day, 1);
  return day;
}
test("one-person salon setup", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55498),
    { db } = fixture;
  try {
    for (const [id, name] of [
      [ownerId, "Сараа"],
      [helperId, "Туслах"],
      [otherId, "Өөр эзэн"],
    ])
      await db.user.create({
        data: { id, email: `${id.slice(-2)}@example.test`, name },
      });
    const owner = await newSalon(db, "solo", ownerId, 2);
    const date = workday();
    const slots = async () =>
      (
        await visitAvailability(db, "goo-neils-solo", {
          branchId: "solo-branch",
          date,
          items: [{ serviceId: "solo-service-1" }],
        })
      ).slots;
    await t.test("a new salon has services but nobody to book", async () => {
      assert.deepEqual(await setupProgress(db, "solo"), {
        services: true,
        staff: false,
        hours: false,
      });
      assert.deepEqual(await slots(), []);
    });
    await t.test("the owner becomes the master in one step", async () => {
      const result = await setupSoloOwner(db, owner);
      assert.equal(result.created, true);
      const staff = await db.staff.findUniqueOrThrow({
        where: { id: result.staffId },
        include: { services: true, branches: true },
      });
      assert.equal(staff.name, "Сараа");
      assert.equal(staff.memberId, "solo-owner");
      assert.deepEqual(staff.services.map((s) => s.serviceId).sort(), [
        "solo-service-1",
        "solo-service-2",
      ]);
      assert.deepEqual(
        staff.branches.map((b) => b.branchId),
        ["solo-branch"],
      );
      const hours = await db.workingHours.findMany({
        where: { staffId: staff.id },
        orderBy: { dayOfWeek: "asc" },
      });
      assert.deepEqual(
        hours.map((h) => [h.dayOfWeek, h.startMinute, h.endMinute]),
        [1, 2, 3, 4, 5, 6].map((d) => [d, 600, 1140]),
      );
      assert.deepEqual(await setupProgress(db, "solo"), {
        services: true,
        staff: true,
        hours: true,
      });
    });
    await t.test("free times appear in the booking availability", async () => {
      const free = await slots();
      assert.ok(free.length > 0);
      assert.equal(localStamp(free[0].startAt).slice(0, 16), `${date}T10:00`);
    });
    await t.test("repeating it creates nothing twice", async () => {
      const again = await setupSoloOwner(db, owner);
      assert.equal(again.created, false);
      assert.equal(await db.staff.count({ where: { salonId: "solo" } }), 1);
      assert.equal(
        await db.workingHours.count({ where: { salonId: "solo" } }),
        6,
      );
      assert.equal(
        await db.staffService.count({ where: { salonId: "solo" } }),
        2,
      );
      // A service added later is picked up; edited hours are left alone.
      await db.service.create({
        data: {
          id: "solo-service-3",
          salonId: "solo",
          categoryId: "solo-category",
          name: "Үйлчилгээ 3",
          durationMinutes: 30,
          priceMnt: 20000,
          branches: { create: { branchId: "solo-branch" } },
        },
      });
      await db.workingHours.updateMany({
        where: { salonId: "solo", dayOfWeek: 6 },
        data: { endMinute: 900 },
      });
      await setupSoloOwner(db, owner);
      assert.equal(
        await db.staffService.count({ where: { salonId: "solo" } }),
        3,
      );
      const saturday = await db.workingHours.findFirstOrThrow({
        where: { salonId: "solo", dayOfWeek: 6 },
      });
      assert.equal(saturday.endMinute, 900);
    });
    const newService = (name: string) =>
      saveService(db, owner, {
        name,
        description: "",
        categoryId: "solo-category",
        priceMnt: 30000,
        durationMinutes: 45,
        onlineBookable: true,
        active: true,
        branchIds: ["solo-branch"],
      });
    await t.test("a service added later goes to the only master", async () => {
      const { id, staffAssigned, chooseStaff } = await newService("Будалт");
      assert.equal(staffAssigned, true);
      assert.equal(chooseStaff, false);
      assert.equal(
        await db.staffService.count({
          where: { salonId: "solo", serviceId: id },
        }),
        1,
      );
      const free = await visitAvailability(db, "goo-neils-solo", {
        branchId: "solo-branch",
        date,
        items: [{ serviceId: id }],
      });
      assert.ok(free.slots.length > 0);
      const catalog = await publicCatalog(db, "goo-neils-solo");
      assert.ok(catalog.services.some((s) => s.id === id));
    });
    await t.test("with two masters the owner picks who offers it", async () => {
      await db.staff.create({
        data: {
          id: "solo-second",
          salonId: "solo",
          name: "Номин",
          title: "",
          branches: { create: { branchId: "solo-branch" } },
        },
      });
      const { id, staffAssigned, chooseStaff } = await newService("Хөмсөг");
      assert.equal(staffAssigned, false);
      assert.equal(chooseStaff, true);
      assert.equal(
        await db.staffService.count({
          where: { salonId: "solo", serviceId: id },
        }),
        0,
      );
      const admin = await readCatalog(db, owner);
      assert.equal(admin.services.find((s) => s.id === id)?.unstaffed, true);
      assert.equal(
        admin.services.find((s) => s.name === "Будалт")?.unstaffed,
        false,
      );
      // Guests never see a service nobody offers.
      const catalog = await publicCatalog(db, "goo-neils-solo");
      assert.ok(!catalog.services.some((s) => s.id === id));
      await db.staff.delete({
        where: { id_salonId: { id: "solo-second", salonId: "solo" } },
      });
    });
    await t.test("owner only, own salon only, needs a service", async () => {
      await db.salonMember.create({
        data: {
          id: "solo-manager",
          salonId: "solo",
          userId: helperId,
          role: "MANAGER",
          branches: { create: { branchId: "solo-branch" } },
        },
      });
      const manager = actorFromMember(
        await db.salonMember.findUniqueOrThrow({
          where: { id: "solo-manager" },
          include: { branches: true, staff: { include: { branches: true } } },
        }),
      );
      await assert.rejects(setupSoloOwner(db, manager), status(403));
      // Another salon's owner only ever touches their own salon.
      const empty = await newSalon(db, "empty", otherId, 0);
      await assert.rejects(setupSoloOwner(db, empty), status(409));
      assert.equal(await db.staff.count({ where: { salonId: "empty" } }), 0);
      assert.equal(await db.staff.count({ where: { salonId: "solo" } }), 1);
    });
    await t.test(
      "a salon under review: its team previews free times",
      async () => {
        await db.salon.update({
          where: { id: "solo" },
          data: { reviewStatus: "PENDING" },
        });
        const query = {
          branchId: "solo-branch",
          date,
          items: [{ serviceId: "solo-service-1" }],
        };
        // The public API stays closed until approval.
        await assert.rejects(
          visitAvailability(db, "goo-neils-solo", query),
          status(404),
        );
        const preview = await previewVisitAvailability(
          db,
          owner,
          "goo-neils-solo",
          query,
        );
        assert.ok(preview.slots.length > 0);
        assert.equal(
          localStamp(preview.slots[0].startAt).slice(0, 16),
          `${date}T10:00`,
        );
        // Another salon's owner gets nothing.
        const outsider = actorFromMember(
          await db.salonMember.findUniqueOrThrow({
            where: { id: "empty-owner" },
            include: { branches: true, staff: { include: { branches: true } } },
          }),
        );
        await assert.rejects(
          previewVisitAvailability(db, outsider, "goo-neils-solo", query),
          status(404),
        );
        await fixture.settle();
      },
    );
  } finally {
    await fixture.close();
  }
});
