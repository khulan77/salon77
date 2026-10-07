// Opt-in only: additive fixtures in the configured PostgreSQL database, precisely scoped cleanup.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import {
  createBooking,
  bookingConflict,
  changeBooking,
  availability,
  readBooking,
  listBookings,
  publicReceipt,
} from "../../lib/services/bookings";
import { localStamp, addDays, localInstant } from "../../lib/business-time";
import { customerDetail } from "../../lib/services/customers";
import { HttpError } from "../../lib/errors";
import type { Actor } from "../../lib/access";
loadEnvConfig(process.cwd());
test(
  "live PostgreSQL: independent sessions, concurrent identical/partial overlap and idempotency",
  { skip: process.env.SALON77_LIVE_BOOKING_TEST !== "1", timeout: 180000 },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set("connection_limit", "1");
    const left = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    const right = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    const suffix = randomUUID();
    const salonId = `booking-test-${suffix}`,
      userId = randomUUID();
    const branchId = `branch-${suffix}`,
      staffId = `staff-${suffix}`,
      memberId = `member-${suffix}`;
    const service90 = `90-${suffix}`,
      service60 = `60-${suffix}`;
    const actor: Actor = {
      id: memberId,
      userId,
      salonId,
      role: "SALON_OWNER",
      branchIds: [],
    };
    const date = addDays(localStamp(new Date()).slice(0, 10), 25);
    const input = (time: string, serviceId = service90) => ({
      branchId,
      staffId,
      serviceId,
      startAt: localInstant(`${date}T${time}`).toISOString(),
      customer: { name: "Зэрэгцээ туршилт", phone: "99112233" },
      idempotencyKey: randomUUID(),
    });
    try {
      await left.user.create({
        data: { id: userId, email: `${suffix}@booking-test.invalid` },
      });
      await left.salon.create({
        data: {
          id: salonId,
          slug: `test-${suffix}`,
          name: "Захиалгын автомат туршилт",
          phone: "99112233",
        },
      });
      await left.salonMember.create({
        data: { id: memberId, userId, salonId, role: "SALON_OWNER" },
      });
      await left.branch.create({
        data: {
          id: branchId,
          salonId,
          name: "Туршилт",
          district: "Хан-Уул",
          address: "Туршилт",
          phone: "99112233",
        },
      });
      const category = await left.serviceCategory.create({
        data: { salonId, name: "Туршилт" },
      });
      for (const [id, durationMinutes] of [
        [service90, 90],
        [service60, 60],
      ] as const)
        await left.service.create({
          data: {
            id,
            salonId,
            categoryId: category.id,
            name: "Маникюр",
            durationMinutes,
            priceMnt: 65000,
            onlineBookable: true,
            branches: { create: { branchId } },
          },
        });
      await left.staff.create({
        data: {
          id: staffId,
          salonId,
          name: "Ану",
          title: "Мастер",
          branches: { create: { branchId } },
          services: {
            create: [{ serviceId: service90 }, { serviceId: service60 }],
          },
        },
      });
      for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++)
        await left.workingHours.create({
          data: {
            salonId,
            branchId,
            staffId,
            dayOfWeek,
            startMinute: 600,
            endMinute: 1080,
            breaks: { create: { startMinute: 780, endMinute: 840 } },
          },
        });
      await t.test(
        "two independent PostgreSQL backends are held concurrently",
        async () => {
          let arrived = 0;
          let release!: () => void;
          const gate = new Promise<void>((r) => {
            release = r;
          });
          const held = (db: PrismaClient) =>
            db.$transaction(
              async (tx) => {
                const rows = await tx.$queryRaw<
                  { pid: number }[]
                >`SELECT pg_backend_pid() AS pid`;
                if (++arrived === 2) release();
                await gate;
                return rows[0].pid;
              },
              { timeout: 15000 },
            );
          const pids = await Promise.all([held(left), held(right)]);
          assert.notEqual(pids[0], pids[1]);
        },
      );
      async function race(
        a: ReturnType<typeof input>,
        b: ReturnType<typeof input>,
      ) {
        const result = await Promise.allSettled([
          createBooking(left, { actor }, a),
          createBooking(right, { actor }, b),
        ]);
        const successes = result.filter((r) => r.status === "fulfilled");
        const failures = result.filter((r) => r.status === "rejected");
        assert.equal(
          successes.length,
          1,
          "exactly one concurrent request must succeed",
        );
        assert.equal(failures.length, 1);
        const reason = failures[0].reason;
        assert.ok(reason instanceof HttpError);
        assert.equal(reason.status, 409);
        assert.equal(reason.message, bookingConflict);
        assert.equal(
          await left.booking.count({
            where: { salonId, status: { not: "CANCELLED" } },
          }),
          1,
        );
        const winner = successes[0].value;
        await changeBooking(left, actor, winner.id, {
          action: "status",
          status: "CANCELLED",
          version: winner.version,
        });
      }
      await t.test(
        "simultaneous identical 14:00–15:30: one success, one 409",
        () => race(input("14:00"), input("14:00")),
      );
      await t.test(
        "simultaneous partial overlap 14:00–15:30 vs 15:00–16:00: one success, one 409",
        () => race(input("14:00"), input("15:00", service60)),
      );
      await t.test(
        "simultaneous identical idempotency key returns the same booking",
        async () => {
          const payload = input("10:00");
          const bookings = await Promise.all([
            createBooking(left, { actor }, payload),
            createBooking(right, { actor }, payload),
          ]);
          assert.equal(bookings[0].id, bookings[1].id);
          assert.equal(
            await left.booking.count({
              where: { salonId, idempotencyKey: payload.idempotencyKey },
            }),
            1,
          );
        },
      );
      await t.test(
        "real database acceptance: reception reschedule/completion, guest calendar and cross-tenant isolation",
        async () => {
          const nextDate = addDays(date, 1);
          const at = (time: string) =>
            localInstant(`${nextDate}T${time}`).toISOString();
          await left.salonMember.update({
            where: { id: memberId },
            data: { role: "RECEPTIONIST", branches: { create: { branchId } } },
          });
          const reception = {
            ...actor,
            role: "RECEPTIONIST",
            branchIds: [branchId],
          };
          let booking = await createBooking(
            left,
            { actor: reception },
            { ...input("15:00"), startAt: at("15:00") },
          );
          const query = {
            branchId,
            serviceId: service90,
            staffId,
            date: nextDate,
          };
          let slots = await availability(left, { actor: reception }, query);
          assert.ok(!slots.slots.some((s) => s.startAt === at("14:00")));
          booking = await changeBooking(left, reception, booking.id, {
            action: "reschedule",
            startAt: at("10:00"),
            version: booking.version,
          });
          slots = await availability(left, { actor: reception }, query);
          assert.ok(slots.slots.some((s) => s.startAt === at("15:00")));
          assert.ok(!slots.slots.some((s) => s.startAt === at("10:00")));
          booking = await changeBooking(left, reception, booking.id, {
            action: "status",
            status: "COMPLETED",
            version: booking.version,
          });
          const customer = await customerDetail(
            left,
            reception,
            booking.customerId,
          );
          assert.ok(
            customer.history.some(
              (b) => b.id === booking.id && b.status === "COMPLETED",
            ),
          );
          const online = await createBooking(
            right,
            { slug: `test-${suffix}` },
            { ...input("15:00"), startAt: at("15:00"), staffId: undefined },
          );
          assert.equal(online.status, "PENDING");
          assert.equal(online.source, "ONLINE");
          assert.ok(
            (
              await listBookings(left, reception, { date: nextDate, days: 1 })
            ).some((b) => b.id === online.id),
          );
          assert.equal(
            "customerId" in (await publicReceipt(left, online)),
            false,
          );
          const otherId = `${salonId}-b`;
          await left.salon.create({
            data: {
              id: otherId,
              slug: `test-b-${suffix}`,
              name: "Өөр туршилтын салон",
              phone: "99112233",
            },
          });
          const otherMember = await left.salonMember.create({
            data: { userId, salonId: otherId, role: "SALON_OWNER" },
          });
          const other = { ...actor, id: otherMember.id, salonId: otherId };
          const denied = (e: unknown) =>
            e instanceof HttpError && e.status === 404;
          await assert.rejects(readBooking(left, other, booking.id), denied);
          await assert.rejects(
            customerDetail(left, other, booking.customerId),
            denied,
          );
          await assert.rejects(
            changeBooking(left, other, online.id, {
              action: "status",
              status: "CANCELLED",
              version: online.version,
            }),
            denied,
          );
          await assert.rejects(
            changeBooking(left, other, online.id, {
              action: "reschedule",
              startAt: at("14:00"),
              version: online.version,
            }),
            denied,
          );
          await assert.rejects(
            createBooking(
              left,
              { actor: other },
              { ...input("14:00"), startAt: at("14:00") },
            ),
            denied,
          );
        },
      );
    } finally {
      // Never delete unscoped rows: these IDs were created by this invocation only.
      await left.booking.deleteMany({ where: { salonId } });
      await left.customer.deleteMany({ where: { salonId } });
      await left.workingHours.deleteMany({ where: { salonId } });
      await left.timeOff.deleteMany({ where: { salonId } });
      await left.salon.deleteMany({
        where: { id: { in: [salonId, `${salonId}-b`] } },
      });
      await left.user.deleteMany({ where: { id: userId } });
      await Promise.all([left.$disconnect(), right.$disconnect()]);
    }
  },
);
